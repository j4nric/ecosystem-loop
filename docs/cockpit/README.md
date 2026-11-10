# Cockpit

Projekt-Cockpit als claude.ai-Artefakt: https://claude.ai/artifact/HUkj8htTK7SRZccDfGUqS4

`index.html` ist der Quelltext der Seite. Die Inhalte liegen nicht in der Seite, sondern in der
Artefakt-Datenbank. Claude pflegt sie mit dem Werkzeug `ArtifactData`, der Inhaber beantwortet Fragen
und gibt Feedback direkt auf der Seite.

## Datenmodell

| Sammlung / Dokument | Inhalt                                                                                                                                                                         | Schreibt                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `cockpit/status`    | `phaseTitle`, `phaseStatus`, `summary`, `nextStep`, `updatedAt`, `links[]`, `features[]`                                                                                       | Claude                             |
| `phases/{id}`       | `order`, `title`, `goal`, `status` (done/active/next/later), `items[{text, done}]`, `acceptance[]`, `prs[{num, title}]`                                                        | Claude                             |
| `questions/{id}`    | `order`, `area`, `title`, `context`, `options[]`, `status` (open/answered), `answer`, `answerNote`, `answeredAt`                                                               | Claude stellt, Inhaber antwortet   |
| `feedback/{id}`     | `feature`, `sentiment`, `text`, `createdAt`, `status` (new/seen/done), `reply`                                                                                                 | Inhaber schreibt, Claude antwortet |
| `simruns/{id}`      | `title`, `createdAt`, `model`, `bot`, `runs`, `scenario`, `metrics[{label, value, unit}]`, `charts[{title, xLabel, yFormat, x[], series[{name, values[]}], caption}]`, `notes` | Claude                             |
| `decisions/{id}`    | `date`, `title`, `detail`                                                                                                                                                      | Claude                             |

Diagramme zeigen höchstens 4 Reihen (Farbreihenfolge fest), `yFormat: "pct"` für Anteile 0–1.
