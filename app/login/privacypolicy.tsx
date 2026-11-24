"use client";

import React from "react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f4f6fa", padding: "40px 16px", fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', color: "#1e293b" }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "16px", padding: "36px 44px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
        
        {/* Navigation & Header */}
        <div style={{ marginBottom: "28px", borderBottom: "1px solid #e2e8f0", paddingBottom: "20px" }}>
          <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "600", color: "#3b4780", textDecoration: "none", marginBottom: "16px" }}>
            &larr; Back to Login
          </Link>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a", margin: "0 0 8px 0" }}>
            NG Global Privacy Policy
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "#64748b" }}>
            <span><strong>Last Updated:</strong> 20 November 2026</span>
            <span>&bull;</span>
            <span><strong>App:</strong> NG Global (package name: <code>com.ngglobal</code>)</span>
          </div>
        </div>

        {/* Section 1 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            1. Introduction and Scope
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 12px 0" }}>
            The NG Global mobile application (the &ldquo;App&rdquo;) is a workforce management, attendance verification and payroll application provided by NG Global (&ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;).
          </p>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 12px 0" }}>
            The App is designed for employees, contract workers, supervisors and authorised staff of organisations that use NG Global services (each an &ldquo;Employer&rdquo;). This Privacy Policy explains what personal data we collect, why we collect it, how we use, share, store and protect it, and what rights you have. It is written in accordance with the Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;), the Information Technology Act, 2000 and rules made under it, and the Google Play User Data policy.
          </p>
          <div style={{ backgroundColor: "#f8fafc", padding: "16px 20px", borderRadius: "10px", borderLeft: "4px solid #3b4780", marginTop: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 8px 0", color: "#1e293b" }}>Our Role</h3>
            <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.7", color: "#334155" }}>
              <li style={{ marginBottom: "6px" }}>
                <strong>Employment, attendance and payroll data:</strong> Your Employer decides why and how this data is processed and is the &ldquo;Data Fiduciary&rdquo;. NG Global acts as a &ldquo;Data Processor&rdquo; on the Employer&rsquo;s behalf and under its instructions.
              </li>
              <li>
                <strong>App account, security and device data:</strong> For data needed to operate, secure and support the App itself (for example login and device verification), NG Global may act as a Data Fiduciary in its own right.
              </li>
            </ul>
          </div>
          <p style={{ lineHeight: "1.7", color: "#334155", marginTop: "12px" }}>
            By using the App you confirm that you have read this Privacy Policy. Where your Employer is required to obtain your consent, it will do so separately and clearly before processing begins.
          </p>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            2. Information We Collect
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 16px 0" }}>
            We collect only the information needed to provide workforce management, attendance and payroll services.
          </p>

          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.1 Identity Information</h3>
              <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>Full name</li>
                <li>Employee code</li>
                <li>Gender and date of birth, where provided</li>
                <li>Designation and employment details</li>
              </ul>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.2 Contact Information</h3>
              <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>Mobile number</li>
                <li>Official email address</li>
              </ul>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.3 Attendance Information</h3>
              <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>Punch-in and punch-out timestamps</li>
                <li>Working hours and shift details</li>
                <li>Overtime records</li>
                <li>Attendance history and leave information</li>
              </ul>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.4 Location Information</h3>
              <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>GPS coordinates recorded at the time of punch-in and punch-out.</li>
                <li>Location during active duty hours, only for roles where your Employer has enabled location tracking (such as field staff and supervisors).</li>
              </ul>
              <p style={{ margin: "8px 0 0 0", fontSize: "13px", fontWeight: "600", color: "#0369a1" }}>
                We do not collect your location when you are off duty or outside your configured duty hours.
              </p>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.5 Photographs</h3>
              <p style={{ margin: "0 0 6px 0", lineHeight: "1.6", color: "#475569" }}>
                Live selfie photographs captured at punch-in and punch-out for attendance verification.
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                Selfies are used only so that authorised HR or supervisors can visually verify attendance. We do not create or store facial recognition templates and we do not perform automated facial matching or biometric identification.
              </p>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.6 Financial Information</h3>
              <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>Bank account number and IFSC code</li>
                <li>PAN details</li>
                <li>Salary and payroll information</li>
              </ul>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.7 KYC and Employment Documents</h3>
              <ul style={{ margin: "0 0 8px 0", paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>Aadhaar document, where provided</li>
                <li>PAN card</li>
                <li>Bank passbook</li>
                <li>Other employment verification documents uploaded by authorised personnel</li>
              </ul>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
                Aadhaar information is collected only where required by law or by your Employer for a lawful purpose, is handled in line with the Aadhaar Act, 2016, and is not used for any purpose other than employment verification and statutory compliance.
              </p>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.8 Device Information</h3>
              <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.6", color: "#475569" }}>
                <li>Device model</li>
                <li>Android operating system version</li>
                <li>Application installation identifier or supported device identifier</li>
              </ul>
            </div>

            <div style={{ padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #edf2f7" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e293b" }}>2.9 Third-Party Services Inside the App</h3>
              <p style={{ margin: 0, lineHeight: "1.6", color: "#475569" }}>
                The App may use trusted third-party software components and services for maps, push notifications, crash reporting or app performance. Such providers receive only the limited data needed to deliver their function (for example, delivering notifications, displaying maps or diagnosing crashes). They process data only on our instructions and are not permitted to use it for advertising or for their own marketing purposes.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            3. App Permissions and Their Purpose
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 16px 0" }}>
            The App requests Android permissions only when the related feature is used.
          </p>

          <div style={{ overflowX: "auto", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px 14px", fontWeight: "700", color: "#1e293b", width: "25%" }}>Permission</th>
                  <th style={{ padding: "10px 14px", fontWeight: "700", color: "#1e293b", width: "45%" }}>Why we need it</th>
                  <th style={{ padding: "10px 14px", fontWeight: "700", color: "#1e293b", width: "30%" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Location (foreground)</td>
                  <td style={{ padding: "10px 14px" }}>Verify attendance at assigned branches or work locations and validate geofence boundaries at punch-in and punch-out.</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Requested when you punch attendance.</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Location (background)</td>
                  <td style={{ padding: "10px 14px" }}>Track location during active duty hours for field staff and supervisors where the Employer has enabled it.</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Only during duty hours. Android may show an ongoing notification while location is being collected.</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Camera</td>
                  <td style={{ padding: "10px 14px" }}>Capture live attendance selfies and attendance-related photographs.</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Opened only when you use a camera feature.</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Storage / document access</td>
                  <td style={{ padding: "10px 14px" }}>Download and save salary slips and tax documents, and upload documents you select.</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Only the files you choose or the App creates. No access to your other files.</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Device information</td>
                  <td style={{ padding: "10px 14px" }}>Account security, registered-device verification and preventing unauthorised access.</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Never used for advertising.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ backgroundColor: "#eff6ff", padding: "16px 20px", borderRadius: "10px", borderLeft: "4px solid #2563eb" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 6px 0", color: "#1e3a8a" }}>Background Location Disclosure</h3>
            <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6", color: "#1e40af" }}>
              For roles where tracking is enabled, the App collects location data in the background, even when the App is closed or not in use, during active duty hours. This is used for work-related verification such as confirming field visits and supervisor movement. The data is shared with your Employer&rsquo;s authorised personnel. You can turn off location permission in your device settings at any time, but doing so may prevent you from punching attendance or performing location-based duties. Please speak to your Employer if you have concerns about tracking.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            4. How We Use and Share Information
          </h2>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "14px 0 6px" }}>4.1 Purposes</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.7", color: "#475569" }}>
            <li>Employee and workforce management</li>
            <li>Attendance and shift management</li>
            <li>Punch-in and punch-out verification and GPS-based attendance validation</li>
            <li>Payroll and salary processing</li>
            <li>Leave and overtime management</li>
            <li>Employee communication and notifications</li>
            <li>Account authentication and security</li>
            <li>Employment and statutory compliance</li>
          </ul>
          <p style={{ margin: "8px 0 12px 0", fontSize: "13.5px", fontWeight: "600", color: "#047857" }}>
            We use your data only for these purposes and not for profiling, advertising or any unrelated purpose.
          </p>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "14px 0 6px" }}>4.2 Lawful Basis</h3>
          <p style={{ margin: 0, lineHeight: "1.6", color: "#475569" }}>
            We process personal data based on your consent, or for &ldquo;certain legitimate uses&rdquo; recognised under Section 7 of the DPDP Act, including processing needed for employment purposes and to comply with legal obligations. Where we rely on consent, you may withdraw it at any time (see Section 7).
          </p>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "14px 0 6px" }}>4.3 Information Sharing</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.7", color: "#475569" }}>
            <li><strong>Your Employer:</strong> Authorised HR personnel, supervisors, administrators and payroll managers can access relevant employee information according to their assigned permissions.</li>
            <li><strong>Service Providers:</strong> Hosting, infrastructure and technical service providers process data on behalf of NG Global under contractual confidentiality and security obligations.</li>
            <li><strong>Government and Legal Authorities:</strong> Information may be disclosed where required by law, court order, regulatory requirement or authorised government investigation.</li>
          </ul>
          <p style={{ margin: "8px 0 12px 0", fontSize: "13.5px", fontWeight: "600", color: "#be123c" }}>
            NG Global does not sell or rent personal information and does not share it with advertisers.
          </p>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "14px 0 6px" }}>4.4 Storage Location and Transfers</h3>
          <p style={{ margin: 0, lineHeight: "1.6", color: "#475569" }}>
            Your data is stored on secure servers operated by NG Global or its hosting providers. If any personal data is transferred outside India, this will be done only as permitted by the DPDP Act and the rules and restrictions notified under it.
          </p>
        </section>

        {/* Section 5 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            5. Data Security
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 12px 0" }}>
            We use reasonable technical and organisational safeguards to protect personal data against unauthorised access, disclosure, alteration or destruction, including:
          </p>
          <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#475569" }}>
            <li><strong>Encryption in transit:</strong> HTTPS/TLS between the App and our servers.</li>
            <li><strong>Secure credential storage:</strong> Authentication credentials and session tokens are stored using Android security mechanisms such as the Keystore.</li>
            <li><strong>Access control:</strong> Role-based access for employee, supervisor and administrative data.</li>
            <li><strong>Server security:</strong> Infrastructure security and access monitoring.</li>
            <li><strong>Protection of sensitive data:</strong> Appropriate safeguards for sensitive employment, identity and financial information such as bank, PAN and Aadhaar details.</li>
          </ul>
          <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6", color: "#64748b" }}>
            No system can be guaranteed to be completely secure. If a personal data breach occurs, we will notify the Data Protection Board of India, affected individuals and the relevant Employer in the manner and within the time required by law.
          </p>
        </section>

        {/* Section 6 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            6. Data Retention and Deletion
          </h2>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "0 0 10px" }}>6.1 Retention</h3>
          <p style={{ lineHeight: "1.6", color: "#334155", margin: "0 0 12px 0" }}>
            We keep personal data only as long as needed to provide the services, fulfil employment purposes, comply with legal obligations and resolve disputes.
          </p>

          <div style={{ overflowX: "auto", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px 14px", fontWeight: "700", color: "#1e293b" }}>Data type</th>
                  <th style={{ padding: "10px 14px", fontWeight: "700", color: "#1e293b" }}>How long it is kept</th>
                  <th style={{ padding: "10px 14px", fontWeight: "700", color: "#1e293b" }}>Basis</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Attendance and payroll records</td>
                  <td style={{ padding: "10px 14px" }}>For the period required under applicable labour, tax and other laws</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Legal obligation</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>KYC and employment documents</td>
                  <td style={{ padding: "10px 14px" }}>For the duration of employment and any further period required by law</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Statutory compliance</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Selfie photographs</td>
                  <td style={{ padding: "10px 14px" }}>As long as needed for attendance verification and dispute resolution, as set by the Employer</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Attendance verification</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Location records</td>
                  <td style={{ padding: "10px 14px" }}>As long as needed for duty-hours verification and dispute resolution, as set by the Employer</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Duty-hours verification</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 14px", fontWeight: "600" }}>Device and security logs</td>
                  <td style={{ padding: "10px 14px" }}>Only as long as needed for account security and fraud prevention</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>Account security</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
            When data is no longer required, it is deleted or irreversibly anonymised.
          </p>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", margin: "14px 0 6px" }}>6.2 Account and Data Deletion Requests</h3>
          <p style={{ margin: 0, lineHeight: "1.6", color: "#475569" }}>
            App accounts are created and managed by your Employer. You can ask for account deletion or erasure of your personal data through your Employer&rsquo;s HR or administrative team, or by contacting us using the developer contact details shown on the App&rsquo;s Google Play Store listing. Please mention your employee code and registered mobile number so that we can identify your account.
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Payroll, tax and statutory employment records may have to be kept for legally required periods even after your account is deactivated or deleted.
          </p>
        </section>

        {/* Section 7 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            7. Your Privacy Rights
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 10px 0" }}>
            Under the DPDP Act and subject to applicable law, you have the right to:
          </p>
          <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#475569" }}>
            <li><strong>Access:</strong> Obtain a summary of the personal data processed about you and the parties it has been shared with.</li>
            <li><strong>Correction and updating:</strong> Have inaccurate or incomplete data corrected or updated.</li>
            <li><strong>Erasure:</strong> Request deletion of your data, subject to legal retention requirements.</li>
            <li><strong>Grievance redressal:</strong> Raise any privacy-related concern or complaint.</li>
            <li><strong>Nomination:</strong> Nominate another person to exercise your rights in the event of your death or incapacity.</li>
            <li><strong>Withdrawal of consent:</strong> Withdraw consent at any time where processing is based on consent. Withdrawal does not affect processing already done, and may limit some App features.</li>
          </ul>
          <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6", color: "#475569" }}>
            You can make requests through your Employer&rsquo;s HR or administrative team or directly to us using the contact details below. We will respond within a reasonable time and in line with applicable law.
          </p>
        </section>

        {/* Section 8 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            8. Grievance Officer and Contact
          </h2>
          <p style={{ lineHeight: "1.7", color: "#334155", margin: "0 0 10px 0" }}>
            If you have a question, request or complaint about how your personal data is handled, you can contact us in either of these ways:
          </p>
          <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px", lineHeight: "1.7", color: "#475569" }}>
            <li><strong>Through your Employer:</strong> Your Employer&rsquo;s authorised HR or administrative team, who will act on the request or escalate it to NG Global where needed.</li>
            <li><strong>Directly with NG Global:</strong> Using the developer contact details (email) shown on the App&rsquo;s Google Play Store listing. Please mention &ldquo;Privacy Request&rdquo; in the subject line and include your employee code and registered mobile number.</li>
          </ul>
          <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6", color: "#475569" }}>
            Your request will be handled by NG Global&rsquo;s grievance redressal team in accordance with the DPDP Act. If you are not satisfied with our response, you may complain to the Data Protection Board of India, once you have first used our grievance process, as provided under the DPDP Act.
          </p>
        </section>

        {/* Section 9 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            9. Children&rsquo;s Privacy
          </h2>
          <p style={{ margin: 0, lineHeight: "1.7", color: "#334155" }}>
            The App is intended only for employees and workers aged 18 years and above and is not designed for children. We do not knowingly collect personal data of anyone under 18. If we identify such data, we will take appropriate action under applicable law, including deleting it.
          </p>
        </section>

        {/* Section 10 */}
        <section style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "10px" }}>
            10. Changes to This Privacy Policy
          </h2>
          <p style={{ margin: "0 0 12px 0", lineHeight: "1.7", color: "#334155" }}>
            We may update this Privacy Policy to reflect changes in features, data practices, services or law. The latest version will always be available on our official Privacy Policy page, with the &ldquo;Last Updated&rdquo; date shown at the top. We will notify users of significant changes through in-app notifications or other suitable channels.
          </p>
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
