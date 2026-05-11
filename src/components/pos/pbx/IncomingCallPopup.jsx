import React from 'react';

// IncomingCallPopup is intentionally disabled. The browser softphone
// (SoftphonePanel) now rings natively via the SignalWire SDK when an
// invite arrives, so a separate popup is no longer needed. Keeping the
// file as a no-op so existing imports (AppLayout, PbxStandalonePage)
// don't have to change while the new ring UI stabilises.
const IncomingCallPopup = () => null;

export default IncomingCallPopup;
