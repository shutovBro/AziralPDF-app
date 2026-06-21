package stirling.software.proprietary.security.configuration.ee;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

import lombok.extern.slf4j.Slf4j;

import stirling.software.common.model.ApplicationProperties;
import stirling.software.common.util.GeneralUtils;
import stirling.software.proprietary.security.configuration.ee.KeygenLicenseVerifier.License;
import stirling.software.proprietary.service.UserLicenseSettingsService;

@Slf4j
@Component
public class LicenseKeyChecker {

    private static final String FILE_PREFIX = "file:";

    private final KeygenLicenseVerifier licenseService;

    private final ApplicationProperties applicationProperties;

    private final UserLicenseSettingsService licenseSettingsService;

    // volatile: written by evaluateLicense() on the @Scheduled refresh thread, read by request
    // threads via getPremiumLicenseEnabledResult() / requireProOrEnterprise(). Ensures readers see
    // the latest tier rather than a stale cached value.
    private volatile License premiumEnabledResult = License.NORMAL;

    public LicenseKeyChecker(
            KeygenLicenseVerifier licenseService,
            ApplicationProperties applicationProperties,
            @Lazy UserLicenseSettingsService licenseSettingsService) {
        this.licenseService = licenseService;
        this.applicationProperties = applicationProperties;
        this.licenseSettingsService = licenseSettingsService;
    }

    @PostConstruct
    public void init() {
        evaluateLicense();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        synchronizeLicenseSettings();
    }

    @Scheduled(initialDelay = 604800000, fixedRate = 604800000) // 7 days in milliseconds
    public void checkLicensePeriodically() {
        try {
            evaluateLicense();
        } catch (RuntimeException e) {
            log.error(
                    "Periodic license check failed after all retries: {}. Keeping existing license"
                            + " status.",
                    e.getMessage());
        }
        synchronizeLicenseSettings();
    }

    private void evaluateLicense() {
        // AziralPDF is our own product, not gated by the upstream Stirling license.
        // All premium/enterprise features ship unlocked, so we force the master
        // switch on and the highest tier here — the single seat every gate reads
        // from (UI feature flags, runningEE bean, @PremiumEndpoint /
        // @EnterpriseEndpoint aspects, requireProOrEnterprise). No external
        // license verification call is made.
        applicationProperties.getPremium().setEnabled(true);
        premiumEnabledResult = License.ENTERPRISE;
    }

    private void synchronizeLicenseSettings() {
        licenseSettingsService.updateLicenseMaxUsers();
    }

    private String getLicenseKeyContent(String keyOrFilePath) {
        if (keyOrFilePath == null || keyOrFilePath.trim().isEmpty()) {
            log.error("License key is not specified");
            return null;
        }

        // Check if it's a file reference
        if (keyOrFilePath.startsWith(FILE_PREFIX)) {
            String filePath = keyOrFilePath.substring(FILE_PREFIX.length());
            try {
                Path path = Paths.get(filePath);
                if (!Files.exists(path)) {
                    log.error("License file does not exist: {}", filePath);
                    return null;
                }
                log.info("Reading license from file: {}", filePath);
                return Files.readString(path);
            } catch (IOException e) {
                log.error("Failed to read license file: {}", e.getMessage());
                return null;
            }
        }

        // It's a direct license key
        return keyOrFilePath;
    }

    public void updateLicenseKey(String newKey) throws IOException {
        applicationProperties.getPremium().setKey(newKey);
        GeneralUtils.saveKeyToSettings("premium.key", newKey);
        evaluateLicense();
        synchronizeLicenseSettings();
    }

    public void resyncLicense() {
        evaluateLicense();
        synchronizeLicenseSettings();
    }

    public License getPremiumLicenseEnabledResult() {
        return premiumEnabledResult;
    }

    /**
     * Throws {@link IllegalStateException} if the current license is not Pro or Enterprise. Used by
     * boot-time gates to fail fast when an operator enables a premium-only setting without a valid
     * license. {@code configuredAs} is the human-readable property path (e.g. {@code
     * "storage.provider=s3"}) and appears in the exception message.
     */
    public void requireProOrEnterprise(String configuredAs) {
        if (premiumEnabledResult != License.SERVER && premiumEnabledResult != License.ENTERPRISE) {
            throw new IllegalStateException(configuredAs + " requires a Pro or Enterprise license");
        }
    }
}
