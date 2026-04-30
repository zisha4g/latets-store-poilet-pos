!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER

Var KioskEmailInput
Var KioskPasswordInput
Var KioskEmailValue
Var KioskPasswordValue

!macro customPageAfterChangeDir
  Page custom KioskCredentialsPageCreate KioskCredentialsPageLeave
!macroend

Function KioskCredentialsPageCreate
  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 18u "Sign in the kiosk during installation"
  Pop $0

  ${NSD_CreateLabel} 0 20u 100% 24u "These credentials will be saved for this Windows user and used automatically every time the kiosk starts."
  Pop $0

  ${NSD_CreateLabel} 0 54u 100% 12u "StorePilot Email"
  Pop $0
  ${NSD_CreateText} 0 68u 100% 12u ""
  Pop $KioskEmailInput

  ${NSD_CreateLabel} 0 92u 100% 12u "StorePilot Password"
  Pop $0
  ${NSD_CreatePassword} 0 106u 100% 12u ""
  Pop $KioskPasswordInput

  nsDialogs::Show
FunctionEnd

Function KioskCredentialsPageLeave
  ${NSD_GetText} $KioskEmailInput $KioskEmailValue
  ${NSD_GetText} $KioskPasswordInput $KioskPasswordValue

  ${If} $KioskEmailValue == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Enter the kiosk email address to continue."
    Abort
  ${EndIf}

  ${If} $KioskPasswordValue == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Enter the kiosk password to continue."
    Abort
  ${EndIf}

  CreateDirectory "$APPDATA\StorePilot"
  Delete "$APPDATA\StorePilot\installer-email.txt"
  Delete "$APPDATA\StorePilot\installer-password.txt"

  FileOpen $1 "$APPDATA\StorePilot\installer-email.txt" w
  FileWrite $1 "$KioskEmailValue"
  FileClose $1

  FileOpen $1 "$APPDATA\StorePilot\installer-password.txt" w
  FileWrite $1 "$KioskPasswordValue"
  FileClose $1
FunctionEnd

!macro customInstall
  Delete "$APPDATA\StorePilot\kiosk-config.json"
  RMDir /r "$APPDATA\StorePilot\Local Storage"
  RMDir /r "$APPDATA\StorePilot\Session Storage"
  RMDir /r "$APPDATA\StorePilot\IndexedDB"
  RMDir /r "$APPDATA\StorePilot\Code Cache"
  RMDir /r "$APPDATA\StorePilot\Cache"
!macroend

!endif

!macro customRemoveFiles
  Delete "$APPDATA\StorePilot\kiosk-config.json"
  Delete "$APPDATA\StorePilot\installer-email.txt"
  Delete "$APPDATA\StorePilot\installer-password.txt"
  RMDir /r "$APPDATA\StorePilot\Local Storage"
  RMDir /r "$APPDATA\StorePilot\Session Storage"
  RMDir /r "$APPDATA\StorePilot\IndexedDB"
  RMDir /r "$APPDATA\StorePilot\Code Cache"
  RMDir /r "$APPDATA\StorePilot\Cache"
!macroend