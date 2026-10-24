# Terms of Service

**Effective date:** [EFFECTIVE DATE]  
**Operator:** [OPERATOR LEGAL NAME]  
**Contact:** [LEGAL CONTACT EMAIL]  
**Governing law:** [GOVERNING JURISDICTION]

> Draft status: this is an implementation-ready first draft, not legal advice. Complete every bracketed placeholder and obtain review for the operator's jurisdiction before public launch.

## 1. Acceptance of these terms

By creating an account, accessing, or using this CodePilot AI instance (the "Service"), you agree to these Terms of Service. If you do not agree, do not use the Service. If you use the Service on behalf of an organisation, you confirm that you are authorised to bind that organisation to these terms.

The Service is open-source software released under the MIT License. These terms govern the hosted instance operated by the party named above; they do not modify the license granted for the source code.

## 2. Eligibility and accounts

- You must be at least 16 years old, or the minimum age of digital consent in your jurisdiction, whichever is higher.
- You must provide accurate account information and keep your credentials confidential.
- You are responsible for activity performed through your account and for any AI provider credentials you connect.
- You must notify [LEGAL CONTACT EMAIL] promptly if you believe your account or connected credentials have been compromised.
- Accounts may not be shared in a way that defeats per-user isolation, quotas, or security controls.

The operator may suspend or terminate accounts that violate these terms, the Acceptable Use Policy, or applicable law.

## 3. GitHub connections and permissions

GitHub access is optional and separate from account registration. When you connect GitHub, you authorise the Service to act within the scopes or installation permissions you approve.

- With a GitHub App installation, only repositories selected during installation are accessible. Installation access tokens are short-lived and revoked by GitHub.
- With an OAuth app fallback, access follows the scopes shown on GitHub's consent screen, which may be broader.
- Read-only access is supported. Write access is only used when you approve a change and explicitly publish it to a new branch.
- The Service will not commit to a repository's default branch, force-push, delete repositories, or modify repository settings.
- You may revoke access at any time in the Service (Integrations → Disconnect) or in your GitHub settings. Revocation stops future access but does not retract commits already created at your direction.
- The Service is not affiliated with GitHub. GitHub's own terms and rate limits apply.

## 4. User-provided AI credentials and model providers

The Service does not include a shared inference account and does not charge for inference.

- You supply your own provider credentials or local runtime. Credentials are encrypted at rest and used only to call the provider you configured.
- You are responsible for complying with each provider's terms, quotas, acceptable-use rules, and billing arrangements.
- The Service applies a free-only eligibility policy by default: only models marked verified free or local are used. You are responsible for confirming that any manual "verified free" classification you record is accurate.
- Paid models are blocked by the backend. The operator does not guarantee that a third-party model remains free, available, or functional.
- Prompts and file content you send to a provider are transmitted to that provider and are subject to its data practices. Review the provider's privacy terms before sending confidential code.

## 5. Model and research provider limitations

Third-party services may impose quotas, rate limits, eligibility requirements, geographic restrictions, or deprecation schedules. The Service displays what it can verify (for example, catalog pricing and the time of the last check) but cannot guarantee accuracy of third-party metadata. Research integrations may return incomplete, outdated, or incorrect results. Always verify security-relevant information against official sources.

## 6. User-generated code and content

You retain ownership of the code, prompts, files, and other content you create or upload ("Your Content"). You grant the operator a limited licence to host, process, and transmit Your Content solely to provide the Service — for example, to send a prompt to your configured model provider or to display a diff.

You are responsible for:

- ensuring you have the rights to the code you import or modify;
- reviewing AI-generated changes before publishing them;
- complying with the licenses of third-party dependencies you introduce;
- not uploading malware, secrets belonging to others, or unlawful material.

AI output may be incorrect, insecure, or non-compliant. The Service presents diffs and real command output precisely so you can verify before publishing.

## 7. Intellectual property

The Service's source code is licensed under the MIT License, including the copyright and permission notice in the LICENSE file. Third-party dependencies and assets remain under their own licenses, listed in THIRD_PARTY_NOTICES.md. "CodePilot AI" branding, if any, is not granted for misleading use.

## 8. Third-party integrations

The Service interoperates with GitHub, model providers, search providers, and optional local runtimes. It does not control those services and is not responsible for their availability, content, security, or charges. Enabling an integration may create a separate contractual relationship between you and that provider.

## 9. Acceptable use

Your use must comply with the Acceptable Use Policy, which is incorporated into these terms by reference. Prohibited conduct includes unauthorised access, credential theft, malware distribution, evasion of authorisation controls, and abuse of execution resources.

## 10. Security and service interruptions

The Service is provided on a best-effort basis. The operator may modify, suspend, or discontinue features, apply rate limits, or take the Service offline for maintenance. No uptime, availability, or data-durability guarantee is offered. Back up your own work: project ZIP download is available for that purpose.

You must not attempt to bypass authentication, cross-tenant isolation, free-only model enforcement, or execution limits. Report vulnerabilities privately to [SECURITY CONTACT EMAIL].

## 11. Free service and quota limitations

The operator does not charge a subscription for the Service, does not display advertisements, and does not intentionally route requests through paid inference services under the default free-only policy. This is an operating commitment, not a promise of unlimited resources.

Third-party services you configure may charge you directly. You are solely responsible for avoiding unintended charges, including by misconfiguring a custom endpoint, enabling a paid provider plan, or using a service that meters usage. CodePilot AI cannot detect every billing arrangement.

The operator may impose technical quotas (message rate, task concurrency, execution time, storage) to keep the instance available to everyone.

## 12. Data retention and account deletion

Account data, chats, project files, provider configuration, research queries, task logs, and change history are retained while your account exists. You can delete individual chats, projects, providers, and your entire account from the application. Account deletion removes the account and its associated database records and workspace directories; encrypted audit records may be retained where required for security or legal purposes. See the Privacy Policy for details.

## 13. Disclaimer of warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. THE OPERATOR DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR THAT AI-GENERATED OUTPUT WILL BE CORRECT OR FIT FOR ANY PURPOSE.

## 14. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE OPERATOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING FROM OR RELATED TO THE SERVICE. WHERE LIABILITY CANNOT BE EXCLUDED, IT IS LIMITED TO THE GREATER OF THE AMOUNT YOU PAID THE OPERATOR FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM (TYPICALLY ZERO) OR THE MINIMUM PERMITTED BY LAW. NOTHING IN THESE TERMS EXCLUDES LIABILITY THAT CANNOT LAWFULLY BE EXCLUDED.

## 15. Indemnity

You agree to indemnify the operator against claims arising from your content, your use of the Service in violation of these terms, or your violation of third-party rights, to the extent permitted by law.

## 16. Changes to these terms

Material changes will be announced in the application or repository with a new effective date. Continued use after the effective date constitutes acceptance. If you do not agree, stop using the Service and delete your account.

## 17. Governing law and disputes

These terms are governed by the laws of [GOVERNING JURISDICTION], without regard to conflict-of-law rules. Courts located in [GOVERNING JURISDICTION] have exclusive jurisdiction, unless mandatory consumer law provides otherwise.

## 18. Contact

Legal: [LEGAL CONTACT EMAIL]  
Privacy: [PRIVACY CONTACT]  
Service address (if required): [SERVICE ADDRESS IF REQUIRED]

## 19. Severability and entire agreement

If a provision is unenforceable, it is limited to the minimum extent necessary and the remaining provisions stay in effect. These terms, the Acceptable Use Policy, and the Privacy Policy are the entire agreement regarding the hosted Service.
