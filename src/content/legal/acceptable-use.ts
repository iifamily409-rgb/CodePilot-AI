export const ACCEPTABLE_USE_MD = `# Acceptable Use Policy

**Effective date:** [EFFECTIVE DATE]  
**Operator:** [OPERATOR LEGAL NAME]  
**Contact:** [LEGAL CONTACT EMAIL]

> Draft status: complete the placeholders and review before public launch.

## 1. Purpose

This policy protects the Service, its operator, and other users. It applies to every account, API call, agent task, execution command, repository connection, and research request.

## 2. Prohibited activity

You must not:

1. **Access systems without authorization.** Attempt to reach accounts, workspaces, repositories, credentials, or infrastructure you do not own or have permission to use.
2. **Steal or expose credentials.** Harvest API keys, tokens, private keys, session cookies, or personal data; place secrets in prompts, repository files, commits, or generated output.
3. **Distribute malware.** Create, store, or publish viruses, ransomware, spyware, botnet tooling, credential stealers, or code whose primary purpose is harm.
4. **Evade security controls.** Bypass authentication, CSRF protection, rate limits, model eligibility checks, execution allowlists, sandbox boundaries, or GitHub permissions.
5. **Abuse execution resources.** Mine cryptocurrency, run denial-of-service tooling, launch network scanners against third parties, attempt container or host escapes, or consume resources far beyond normal development use.
6. **Attack third parties.** Use the Service or its outbound network access to scan, exploit, or overload systems without written authorization.
7. **Engage in illegal conduct.** Violate applicable law, including fraud, harassment, trafficking, child sexual abuse material, or unlawful surveillance.
8. **Infringe rights.** Upload code or content you are not licensed to use, or remove license notices in violation of a license.
9. **Circumvent free-only policy.** Configure endpoints to route to paid inference while claiming zero cost, or misrepresent pricing to enable paid usage.
10. **Deceive or impersonate.** Misrepresent AI-generated output as human professional advice where that would cause harm, or impersonate another person or organisation.
11. **Scrape or harvest data.** Bulk-extract other users' content or personal data from the Service.
12. **Interfere with availability.** Overload the Service, exploit bugs for resource consumption, or attempt to corrupt data.

## 3. Sensitive and high-impact use

The Service is a software development tool. Do not rely on it as the sole decision-maker for medical, legal, financial, safety-critical, or employment decisions. AI output may be wrong, and the operator provides no professional advice.

## 4. Security research

Good-faith security research is welcome under the process in SECURITY.md. Do not test against other users' data, do not degrade availability, and allow reasonable time for remediation before disclosure.

## 5. Content and code you provide

You must have the rights to code you import. You are responsible for license compliance of dependencies you add. Do not upload regulated data (for example health records or special-category personal data) unless you have a lawful basis and the operator has agreed in writing.

## 6. Enforcement

The operator may remove content, throttle requests, disable execution, suspend or terminate accounts, and report unlawful activity to authorities. Where practical, the operator will explain the reason and provide an opportunity to respond. Immediate action may be taken where there is risk to the Service, other users, or third parties.

## 7. Reporting

Report violations to [LEGAL CONTACT EMAIL] with relevant evidence such as timestamps, account identifiers, and request paths. Do not include other users' secrets.

## 8. Changes

This policy may be updated as the Service evolves. Material changes will be announced in the application or repository with a new effective date.
`;
