' Tunel-Baslat.bat dosyasini PENCERESIZ calistirir.
' Amac: tunelin konsol penceresinin yanlislikla kapatilmasini onlemek.
' Zamanlanmis gorev bu dosyayi cagirir. Durum icin logs\tunnel.log dosyasina bakilir.
Dim fso, sh, klasor
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
klasor = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & klasor & "\Tunel-Baslat.bat""", 0, False
