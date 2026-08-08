# ZenChad Tasker charging voice

This folder contains the importable Tasker profile and its offline Ogg Opus voice files.

## Install

1. Copy this entire **ZenChad Charging** folder to your phone at `/storage/emulated/0/Tasker/ZenChad Charging/`.
2. In Tasker, import `ZenChad-Charging-Voice.prf.xml`.
3. If your existing “Charging Sounds” profile is enabled, disable it or it will play alongside this profile.
4. Allow Tasker to run in the background and keep media volume at the level you want.

The profile uses Tasker’s **Power State** context. When power connects, it plays one of four charging responses based on the battery level. When power disconnects, it plays one of three variations chosen for the current local time:

- 22:00–05:59: overnight
- 06:00–11:59: morning
- 12:00–16:59: afternoon
- 17:00–21:59: evening

The variation is selected from the current Unix-second modulo three, so unplugging repeatedly does not always use the same take. All speech is offline; there are no API calls in Tasker.

The XML was based on the Power State, Music Play, Variable Set, If, Else, and End If structures in your existing Tasker export. If your Tasker version reports an import warning, import the profile first and open the two linked tasks to confirm the paths point to this folder.

