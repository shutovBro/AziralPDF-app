# Third-Party Notices

AziralPDF is built on top of the open-source **Stirling-PDF** project
(<https://github.com/Stirling-Tools/Stirling-PDF>), licensed under the MIT License.
The complete upstream copyright notice is preserved in [LICENSE](LICENSE):

> Copyright (c) 2025 Stirling PDF Inc. — MIT License

In accordance with the MIT License, this copyright notice and the LICENSE file are
distributed with every binary, container image, and source release of AziralPDF.

## Modifications

The AziralPDF distribution differs from upstream Stirling-PDF in the following ways:

- Branding, UI assets, and customer-facing copy replaced with AziralPDF identity.
- JWT issuer, OCI image labels, and select configuration defaults rebranded.
- Russian (ru_RU) default locale and Aziral commercial wrapper.

No changes to upstream MIT-licensed source files alter the rights granted to the
original Stirling-PDF authors or downstream users.

## Other Components

AziralPDF additionally bundles open-source components whose licenses are listed in
`app/core/src/main/resources/static/3rdPartyLicenses.json` and are reproduced in the
running application at `/licenses`.
