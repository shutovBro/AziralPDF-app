package stirling.software.proprietary.security.configuration.ee;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static stirling.software.proprietary.security.configuration.ee.KeygenLicenseVerifier.License;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import stirling.software.common.model.ApplicationProperties;
import stirling.software.proprietary.service.UserLicenseSettingsService;

/**
 * AziralPDF is its own product: {@link LicenseKeyChecker#evaluateLicense()} always forces the
 * highest tier and never calls out to {@link KeygenLicenseVerifier}. These tests cover that
 * unconditional-unlock behaviour instead of the upstream key-verification flow it replaced.
 */
@ExtendWith(MockitoExtension.class)
class LicenseKeyCheckerTest {

    @Mock private KeygenLicenseVerifier verifier;
    @Mock private UserLicenseSettingsService userLicenseSettingsService;

    @Test
    void init_alwaysUnlocksEnterprise() {
        ApplicationProperties props = new ApplicationProperties();

        LicenseKeyChecker checker =
                new LicenseKeyChecker(verifier, props, userLicenseSettingsService);
        checker.init();

        assertEquals(License.ENTERPRISE, checker.getPremiumLicenseEnabledResult());
        assertEquals(true, props.getPremium().isEnabled());
        verifyNoInteractions(verifier);
    }

    @Test
    void resyncLicense_reevaluatesAndSyncsSettings() {
        ApplicationProperties props = new ApplicationProperties();
        LicenseKeyChecker checker =
                new LicenseKeyChecker(verifier, props, userLicenseSettingsService);
        checker.init();

        checker.resyncLicense();

        assertEquals(License.ENTERPRISE, checker.getPremiumLicenseEnabledResult());
        verify(userLicenseSettingsService, org.mockito.Mockito.times(1)).updateLicenseMaxUsers();
        verifyNoInteractions(verifier);
    }

    // ----- requireProOrEnterprise: shared boot-time gate for premium features -----

    @Test
    void requireProOrEnterprise_afterInit_passes() {
        ApplicationProperties props = new ApplicationProperties();
        LicenseKeyChecker checker =
                new LicenseKeyChecker(verifier, props, userLicenseSettingsService);
        checker.init();

        assertThatCode(() -> checker.requireProOrEnterprise("any.feature=true"))
                .doesNotThrowAnyException();
    }

    @Test
    void requireProOrEnterprise_beforeInit_throwsWithFeatureName() {
        ApplicationProperties props = new ApplicationProperties();
        LicenseKeyChecker checker =
                new LicenseKeyChecker(verifier, props, userLicenseSettingsService);

        assertThatThrownBy(() -> checker.requireProOrEnterprise("storage.provider=s3"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("storage.provider=s3 requires a Pro or Enterprise license");
    }
}
