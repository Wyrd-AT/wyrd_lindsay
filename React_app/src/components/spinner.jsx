// spinner.jsx
import React from "react";

export default function Spinner(props) {
  return (
    <svg
      viewBox="0 0 50 50"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeDasharray="31.4 31.4"
      {...props}
    >
      <circle cx="25" cy="25" r="20" />
    </svg>
  );
}
