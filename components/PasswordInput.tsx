"use client";

import React, { useState } from "react";

/** Password box with a Show / Hide toggle (same wording as the Login page). Takes every normal <input> prop. */
export default function PasswordInput({ style, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "block", width: style?.width ?? "100%" }}>
      <input {...rest} type={show ? "text" : "password"} style={{ ...style, width: "100%", paddingRight: 56 }} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#4a5a8a", padding: 0 }}>
        {show ? "HIDE" : "SHOW"}
      </button>
    </span>
  );
}
