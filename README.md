# Status praesens

Frontend-Tool für standardisierte Dokumentation der körperlichen Untersuchung.

## Starten

Im Projektordner einen lokalen Server starten, z. B.:

```bash
python3 -m http.server 5173
```

Danach im Browser `http://localhost:5173` öffnen.

## Katalog anpassen

Die Navigation steht in `navigation.json`. Jeder Eintrag verweist über `file` auf einen eigenen Seitenkatalog. Füge dort eine Seite mit eindeutiger `id`, sichtbarem `label` und JSON-Datei hinzu; die Datei folgt demselben Format wie `kategorien.json`.

Die vorhandenen Seitenkataloge sind `kategorien.json` (RD-intern), `rd-advanced.json` (RD-trauma) und `klinischer-status.json`. Auswahlstände werden pro Seite getrennt im Browser gespeichert.

Zugang: In `config.json` steht nur der SHA-256-Hash des Passworts (`auth.passwordHash`). Der Klartext gehört nicht in die Konfiguration.

- `type`: `single` (eine Option) oder `multiple` (mehrere Optionen)
- `groups`: optionale Untergruppen mit eigenem `type`
- `label`: Beschriftung am Button
- `text`: Text, der in den Absatz eingefügt wird
- `exclusive`: bei Mehrfachauswahl schließt diese Option die übrigen aus (z. B. „unauffällig“)
- `showWhen`: blendet eine Gruppe bedingt ein, z. B. `{ "groupId": "druckdolenz", "optionId": "ja" }`
- `prefix` / `suffix` / `groupJoiner` / `categoryJoiner`: steuern den fertigen Satz
