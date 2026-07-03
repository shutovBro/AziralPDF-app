package stirling.software.proprietary.security.filter;

import java.time.LocalDate;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import stirling.software.proprietary.security.database.repository.UserRepository;
import stirling.software.proprietary.security.model.LicenseTier;
import stirling.software.proprietary.security.model.User;

/**
 * Caps how many PDF operations a FREE-tier user can run per calendar day. Paid tiers
 * (PRO/ENTERPRISE) are unlimited. The counter is in-memory per process and resets at midnight (or
 * on restart). Registered only for PDF tool endpoints (see {@code ProprietaryWebMvcConfig}), so it
 * never affects auth, account or admin calls.
 *
 * <p>The daily allowance is configurable via {@code aziral.free-daily-limit} (default 20); 0 or
 * negative disables the cap.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FreeTierLimitInterceptor implements HandlerInterceptor {

    private final UserRepository userRepository;

    @Value("${aziral.free-daily-limit:20}")
    private int freeDailyLimit;

    // key: "username|yyyy-MM-dd" -> operations used today
    private final ConcurrentHashMap<String, AtomicInteger> counters = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (freeDailyLimit <= 0 || !"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            return true;
        }

        String username = authentication.getName();
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(username);
        if (userOpt.isEmpty() || userOpt.get().getEffectiveLicenseTier() != LicenseTier.FREE) {
            return true; // unknown user handled elsewhere; paid tiers are unlimited
        }

        String key = username + "|" + LocalDate.now();
        int used = counters.computeIfAbsent(key, k -> new AtomicInteger(0)).incrementAndGet();
        if (used > freeDailyLimit) {
            log.info(
                    "Free-tier daily limit reached for user {} ({}/{})",
                    username,
                    freeDailyLimit,
                    freeDailyLimit);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter()
                    .write(
                            "{\"error\":\"You have reached your free plan daily limit of "
                                    + freeDailyLimit
                                    + " operations. Upgrade to Pro for unlimited access.\","
                                    + "\"limitReached\":true,\"limit\":"
                                    + freeDailyLimit
                                    + "}");
            return false;
        }
        response.setHeader("X-Free-Tier-Remaining", String.valueOf(freeDailyLimit - used));
        return true;
    }

    @Scheduled(fixedDelay = 3_600_000)
    public void cleanupOldDays() {
        String today = "|" + LocalDate.now();
        counters.keySet().removeIf(k -> !k.endsWith(today));
    }
}
