package stirling.software.proprietary.security.model;

/**
 * AziralPDF per-user subscription tier.
 *
 * <p>This is AziralPDF's own licensing model, independent of the upstream Stirling-PDF Keygen
 * license. Each {@link User} carries an effective tier (see {@code User.getEffectiveLicenseTier()})
 * that admins can assign and that users can buy.
 */
public enum LicenseTier {
    FREE,
    PRO,
    ENTERPRISE
}
