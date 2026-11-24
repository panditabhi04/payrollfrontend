"use client";

import React from "react";
import Link from "next/link";

export default function TermsAndConditionsPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f4f6fa", padding: "40px 16px", fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', color: "#1e293b" }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "16px", padding: "36px 44px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
        
        {/* Navigation & Header */}
        <div style={{ marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "20px" }}>
          <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "600", color: "#3b4780", textDecoration: "none", marginBottom: "16px" }}>
            &larr; Back to Login
          </Link>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a", margin: "0 0 8px 0" }}>
            NG Global Terms and Conditions
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "#64748b" }}>
            <span><strong>Last Updated:</strong> 20 November 2026</span>
            <span>&bull;</span>
            <span><strong>App:</strong> NG Global (package name: <code>com.ngglobal</code>)</span>
          </div>
          <p style={{ margin: "16px 0 0 0", lineHeight: "1.7", color: "#475569", fontSize: "14.5px" }}>
            These Terms and Conditions (&ldquo;Terms&rdquo;) govern your use of the NG Global mobile application (the &ldquo;App&rdquo;), a workforce management, attendance verification and payroll application provided by NG Global (&ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;). Please read them carefully together with our Privacy Policy.
          </p>
        </div>

        {/* Section 1 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            1. Acceptance of Terms
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            By installing, logging in to or using the App, you confirm that you have read, understood and agreed to these Terms and our Privacy Policy. If you do not agree, please do not use the App. These Terms are an electronic record under the Information Technology Act, 2000 and do not require a physical or digital signature.
          </p>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            2. Definitions
          </h2>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li><strong>&ldquo;Employer&rdquo;</strong> means the organisation that engages you and has enabled NG Global services for its workforce.</li>
            <li><strong>&ldquo;User&rdquo; or &ldquo;you&rdquo;</strong> means any employee, contract worker, supervisor or authorised staff member who uses the App.</li>
            <li><strong>&ldquo;Account&rdquo;</strong> means the login credentials and profile created for you to access the App.</li>
            <li><strong>&ldquo;Services&rdquo;</strong> means the attendance, location verification, leave, overtime, payroll, salary slip and related features available in the App.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            3. Eligibility
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            The App is intended only for persons aged 18 years or above who are employed or engaged by an Employer that uses NG Global services. You must be authorised by your Employer to use the App.
          </p>
        </section>

        {/* Section 4 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            4. Your Account
          </h2>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li>Accounts are created and managed by your Employer or its authorised administrators. You cannot create an account on your own.</li>
            <li>You must keep your login credentials, one-time passwords and device confidential and must not share them with anyone.</li>
            <li>You are responsible for all activity carried out through your Account. Please inform your Employer or us immediately if you suspect unauthorised use.</li>
            <li>The App may be linked to a registered device. Using the App on an unregistered device may require approval from your Employer.</li>
            <li>You must provide accurate and up-to-date information and ensure that documents you upload are genuine.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            5. The Services
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 8px 0" }}>
            Depending on how your Employer has configured the App, the Services may include:
          </p>
          <ul style={{ margin: "0 0 8px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li>Punch-in and punch-out with GPS location and live selfie verification</li>
            <li>Shift, working hours, overtime and attendance history</li>
            <li>Leave requests and approvals</li>
            <li>Salary slips, payroll and tax-related documents</li>
            <li>Location tracking during duty hours for field staff and supervisors, where enabled by the Employer</li>
            <li>Notifications and communication from your Employer</li>
          </ul>
          <p style={{ lineHeight: "1.6", color: "#64748b", margin: 0, fontSize: "13.5px" }}>
            Features and access levels differ from one Employer and role to another. Your Employer decides which features are enabled for you.
          </p>
        </section>

        {/* Section 6 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            6. Permissions and Consent
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            To use the attendance features, the App needs access to your device&rsquo;s location and camera, and to documents you choose to upload or download. Location may also be collected in the background during active duty hours if your Employer has enabled this for your role. You can change these permissions at any time in your device settings, but if you disable them, you may not be able to mark attendance or use related features. How we handle your data is explained in our Privacy Policy.
          </p>
        </section>

        {/* Section 7 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            7. Acceptable Use
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 8px 0" }}>
            You agree that you will use the App honestly and only for lawful, work-related purposes. You must not:
          </p>
          <ul style={{ margin: "0 0 10px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#475569" }}>
            <li>Mark attendance for another person, or allow another person to mark attendance for you</li>
            <li>Use fake or mock GPS locations, location-spoofing apps, emulators, rooted-device tricks or any method to give a false location</li>
            <li>Submit selfies or photographs that are of another person, edited, pre-recorded or taken from a screen or a printed photograph</li>
            <li>Provide false, misleading or forged information or documents</li>
            <li>Access or attempt to access another user&rsquo;s account, data or any part of the App for which you are not authorised</li>
            <li>Copy, modify, reverse engineer, decompile or attempt to extract the source code of the App, except as allowed by law</li>
            <li>Interfere with, overload, scan for vulnerabilities in or disrupt the App, its servers or networks</li>
            <li>Introduce malware or any harmful code</li>
            <li>Use the App to harass, threaten or harm anyone, or for any unlawful purpose</li>
            <li>Use automated tools, bots or scripts to access the App</li>
          </ul>
          <div style={{ backgroundColor: "#fef2f2", padding: "12px 16px", borderRadius: "8px", borderLeft: "4px solid #ef4444", fontSize: "13.5px", color: "#991b1b" }}>
            Any such misuse may be reported to your Employer and may lead to disciplinary action by your Employer, suspension of your Account and, where required, legal action.
          </div>
        </section>

        {/* Section 8 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            8. Relationship with Your Employer
          </h2>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li>NG Global provides the App as a technology service. NG Global is not your employer and is not a party to your employment or engagement contract.</li>
            <li>Matters such as your attendance policy, shifts, leave, overtime, salary, deductions, tax, benefits, disciplinary action and termination are decided by your Employer under your employment terms and applicable law.</li>
            <li>Your Employer&rsquo;s authorised HR personnel, supervisors, administrators and payroll managers can view and manage your data in the App according to their permissions.</li>
            <li>Any dispute about pay, attendance records or employment should be raised with your Employer first.</li>
          </ul>
        </section>

        {/* Section 9 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            9. Accuracy of Attendance and Payroll Information
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            Attendance, working hours and payroll figures shown in the App are generated from data entered or approved by you, your supervisor and your Employer, and from device inputs such as time and GPS. They may be affected by device settings, network connectivity, GPS accuracy and configuration by your Employer. If you notice an error, please inform your Employer&rsquo;s HR or payroll team so that it can be corrected. Salary slips and payroll documents in the App are provided for your convenience, and your Employer&rsquo;s official records prevail.
          </p>
        </section>

        {/* Section 10 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            10. Privacy and Data Protection
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            Your personal data is processed in accordance with our Privacy Policy and the Digital Personal Data Protection Act, 2023. The Privacy Policy forms part of these Terms. You can exercise your data rights, including access, correction, erasure, grievance redressal, nomination and withdrawal of consent, as described in the Privacy Policy.
          </p>
        </section>

        {/* Section 11 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            11. Intellectual Property
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            The App, including its software, design, text, graphics, logos and all related intellectual property rights, belongs to NG Global or its licensors. We grant you a limited, personal, non-exclusive, non-transferable and revocable licence to install and use the App on your device solely for work-related purposes during the period you are authorised by your Employer. No other rights are granted to you. Data entered by you or your Employer remains the property of its respective owner, and you allow us to process it only to provide the Services.
          </p>
        </section>

        {/* Section 12 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            12. Availability and Updates
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            We try to keep the App available and secure, but we do not guarantee that it will always be uninterrupted, error-free or free from delays. The App may be unavailable from time to time because of maintenance, updates, network problems, device issues or reasons beyond our control. We may update, modify or discontinue features, and you may need to install updates to continue using the App. If the App is unavailable, please follow your Employer&rsquo;s alternate attendance procedure.
          </p>
        </section>

        {/* Section 13 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            13. Suspension and Termination
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 8px 0" }}>
            Your access to the App may be suspended or ended:
          </p>
          <ul style={{ margin: "0 0 8px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li>When your employment or engagement with the Employer ends, or the Employer asks us to deactivate your Account</li>
            <li>If you violate these Terms or misuse the App</li>
            <li>If required by law or to protect the security of the App, other users or the Employer</li>
            <li>If the Employer&rsquo;s agreement with NG Global ends</li>
          </ul>
          <p style={{ lineHeight: "1.6", color: "#64748b", margin: 0, fontSize: "13.5px" }}>
            After termination, your right to use the App ends immediately. Data may continue to be retained for the periods described in the Privacy Policy and as required by law.
          </p>
        </section>

        {/* Section 14 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            14. Disclaimer of Warranties
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            To the extent permitted by law, the App and the Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not make any warranty, express or implied, about the accuracy of location or time data, uninterrupted operation, or suitability for a particular purpose, other than those that cannot be excluded under applicable law.
          </p>
        </section>

        {/* Section 15 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            15. Limitation of Liability
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            To the extent permitted by law, NG Global will not be liable for any indirect, incidental, special or consequential loss, or for loss of wages, profit, data or opportunity arising out of your use of, or inability to use, the App, including losses caused by GPS or network errors, device faults, incorrect data entered by you or your Employer, or decisions taken by your Employer. Nothing in these Terms limits any liability that cannot be limited under applicable law, or any right you have under data protection laws.
          </p>
        </section>

        {/* Section 16 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            16. Indemnity
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            You agree to be responsible for any loss or claim that arises from your deliberate misuse of the App or your breach of these Terms, including submission of false attendance, location or documents, to the extent permitted by law.
          </p>
        </section>

        {/* Section 17 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            17. Governing Law and Disputes
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            These Terms are governed by the laws of India. We encourage you to first raise any concern with your Employer or with us through the contact details below so that it can be resolved amicably. If a dispute is not resolved, it will be subject to the jurisdiction of the competent courts in India, subject to any rights you have under applicable consumer, labour or data protection laws.
          </p>
        </section>

        {/* Section 18 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            18. Contact and Grievances
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 8px 0" }}>
            For questions about these Terms, or for any grievance, you can contact us in either of these ways:
          </p>
          <ul style={{ margin: "0 0 8px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li><strong>Through your Employer:</strong> Your Employer&rsquo;s authorised HR or administrative team, who will act on the matter or escalate it to NG Global where needed.</li>
            <li><strong>Directly with NG Global:</strong> Using the developer contact details (email) shown on the App&rsquo;s Google Play Store listing. Please mention your employee code and registered mobile number so that we can identify your Account.</li>
          </ul>
          <p style={{ lineHeight: "1.6", color: "#64748b", margin: 0, fontSize: "13.5px" }}>
            Privacy-related requests and complaints will be handled as described in the Privacy Policy.
          </p>
        </section>

        {/* Section 19 */}
        <section style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            19. Changes to These Terms
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: 0 }}>
            We may update these Terms from time to time to reflect changes in the App, our Services or applicable law. The latest version will be available on our official Terms and Conditions page with the &ldquo;Last Updated&rdquo; date shown at the top. We may inform you of significant changes through in-app notifications or other suitable channels. Your continued use of the App after the changes take effect means that you accept the updated Terms.
          </p>
        </section>

        {/* Section 20 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            20. General
          </h2>
          <ul style={{ margin: "0 0 16px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
            <li><strong>Severability:</strong> If any part of these Terms is found to be unenforceable, the remaining parts will continue to apply.</li>
            <li><strong>No waiver:</strong> A delay or failure to enforce any provision is not a waiver of our rights.</li>
            <li><strong>Entire agreement:</strong> These Terms and the Privacy Policy together make up the agreement between you and NG Global regarding use of the App.</li>
            <li><strong>Assignment:</strong> We may transfer our rights and obligations under these Terms to a successor or affiliate. You may not transfer your rights under these Terms.</li>
          </ul>
          <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <strong style={{ display: "block", fontSize: "15px", color: "#0f172a" }}>NG Global</strong>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Workforce Management | Attendance | HR &amp; Payroll</span>
          </div>
        </section>

        {/* Bottom Back Button */}
        <div style={{ textAlign: "center", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
          <Link href="/login" style={{ display: "inline-block", padding: "10px 24px", backgroundColor: "#3b4780", color: "#ffffff", borderRadius: "8px", fontWeight: "600", fontSize: "14px", textDecoration: "none" }}>
            &larr; Return to Login
          </Link>
        </div>

      </div>
    </div>
  );
}
