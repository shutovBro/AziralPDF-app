package stirling.software.proprietary.security.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import lombok.RequiredArgsConstructor;

import stirling.software.proprietary.security.filter.FreeTierLimitInterceptor;
import stirling.software.proprietary.security.filter.ParticipantRateLimitInterceptor;

@Configuration
@RequiredArgsConstructor
public class ProprietaryWebMvcConfig implements WebMvcConfigurer {

    private final ParticipantRateLimitInterceptor participantRateLimitInterceptor;
    private final FreeTierLimitInterceptor freeTierLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(participantRateLimitInterceptor)
                .addPathPatterns("/api/v1/workflow/participant/**");

        // Cap daily PDF operations for FREE-tier users (paid tiers are unlimited).
        registry.addInterceptor(freeTierLimitInterceptor)
                .addPathPatterns(
                        "/api/v1/general/**",
                        "/api/v1/misc/**",
                        "/api/v1/convert/**",
                        "/api/v1/security/**",
                        "/api/v1/filter/**",
                        "/api/v1/form/**",
                        "/api/v1/analysis/**",
                        "/api/v1/pipeline/**",
                        "/api/v1/mobile-scanner/**");
    }
}
