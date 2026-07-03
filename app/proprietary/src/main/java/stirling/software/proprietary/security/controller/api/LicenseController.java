package stirling.software.proprietary.security.controller.api;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.transaction.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import stirling.software.proprietary.security.database.repository.UserRepository;
import stirling.software.proprietary.security.model.LicenseTier;
import stirling.software.proprietary.security.model.User;

/**
 * AziralPDF own subscription/license API.
 *
 * <p>Independent of the upstream Stirling-PDF Keygen license: each user carries their own tier
 * (FREE/PRO/ENTERPRISE) stored on the user row. Admins assign tiers; the account page reads the
 * current user's effective tier for the subscription badge.
 */
@RestController
@RequestMapping("/api/v1/license")
@Tag(name = "License", description = "AziralPDF per-user subscription management")
@Slf4j
@RequiredArgsConstructor
public class LicenseController {

    private final UserRepository userRepository;

    /** Returns the authenticated user's own subscription. */
    @GetMapping("/me")
    public ResponseEntity<?> myLicense(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Not authenticated"));
        }
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(authentication.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found"));
        }
        return ResponseEntity.ok(toLicenseMap(userOpt.get()));
    }

    /** Admin: assign or extend a user's subscription tier. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/assign")
    @Transactional
    public ResponseEntity<?> assign(
            @RequestParam("username") String username,
            @RequestParam("tier") String tier,
            @RequestParam(value = "durationDays", required = false) Integer durationDays) {
        LicenseTier parsedTier;
        try {
            parsedTier = LicenseTier.valueOf(tier.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Invalid tier. Use FREE, PRO or ENTERPRISE."));
        }
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(username);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found"));
        }
        User user = userOpt.get();
        user.setLicenseTier(parsedTier);
        if (parsedTier == LicenseTier.FREE) {
            user.setLicenseExpiresAt(null);
        } else if (durationDays != null && durationDays > 0) {
            user.setLicenseExpiresAt(LocalDateTime.now().plusDays(durationDays));
        } else {
            // No duration supplied for a paid tier -> treat as an open-ended grant.
            user.setLicenseExpiresAt(null);
        }
        userRepository.save(user);
        log.info(
                "Admin assigned license tier {} (expires {}) to user {}",
                parsedTier,
                user.getLicenseExpiresAt(),
                username);
        return ResponseEntity.ok(toLicenseMap(user));
    }

    private Map<String, Object> toLicenseMap(User user) {
        LicenseTier stored =
                user.getLicenseTier() == null ? LicenseTier.FREE : user.getLicenseTier();
        Map<String, Object> body = new HashMap<>();
        body.put("tier", user.getEffectiveLicenseTier().name());
        body.put("storedTier", stored.name());
        body.put(
                "expiresAt",
                user.getLicenseExpiresAt() == null ? null : user.getLicenseExpiresAt().toString());
        return body;
    }
}
