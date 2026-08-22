# Quest Schedule to Google Calendar Converter
## Project Overview
Build a lightweight, client-side web application that takes copy-pasted course schedule text from the University of Waterloo's Quest portal and converts it into a downloadable `.ics` (iCalendar) file. This allows students to easily import their recurring class schedules into Google Calendar, Apple Calendar, or Outlook.

## Architecture & Tech Stack
*   **Frontend:** HTML, CSS, JavaScript (Vanilla JS or a lightweight framework like React/Vue, as long as it can run easily as a standalone web app).
*   **Processing:** All text parsing and file generation must happen client-side for privacy and speed. No backend database or server processing is required.
*   **Output:** An `.ics` file containing recurring events for the duration of the academic term.

## UI/UX Requirements
1.  **Header:** Clean, modern title and brief instructions (e.g., "Highlight your entire schedule on Quest, copy, and paste it below").
2.  **Input Area:** A large, responsive `<textarea>` where the user pastes their schedule.
3.  **Action Button:** A prominent "Generate Calendar File" button.
4.  **Feedback/Status:** 
    *   Success message showing how many courses/events were found.
    *   Error state if the text is invalid or cannot be parsed.
    *   Instructions on how to import the downloaded `.ics` file into Google Calendar.

## Parsing Logic (The Core Challenge)
The copy-pasted text is unstructured, usually delimited by newlines or tabs. The parsing algorithm must be robust and pattern-based.

### 1. Identifying Courses
Look for the course header pattern. It typically follows the format:
`[Subject] [Number] - [Course Name]Status`
*Example:* `SYDE 212 - Probability, Stats & Data SciStatus`
The parser should extract the Subject and Number (e.g., "SYDE 212") and the Name (e.g., "Probability, Stats & Data Sci") to use as the Event Title.

### 2. Identifying Class Components (Lectures, Tutorials, Labs)
Under each course, the class details are listed. The parser should look for rows containing time ranges and date ranges. 
*Example block:*
```text
T 10:30AM - 12:20PM
E7 4433
Mike Cooper-Stachowsky
09/09/2026 - 12/08/2026
```
Some classes have multiple time blocks for the same section (e.g., a Tuesday lecture and a Thursday lecture at different times). The parser must capture all orphaned time blocks that belong to the most recent course header.

### 3. Extracting Fields via Regex
*   **Days:** `M`, `T`, `W`, `Th`, `F` (Note: `T` is Tuesday, `Th` is Thursday).
*   **Times:** Pattern `[H]H:MM[AM/PM] - [H]H:MM[AM/PM]`.
*   **Dates:** Pattern `MM/DD/YYYY - MM/DD/YYYY`.
*   **Room:** Usually follows the time, e.g., `E7 4433`.
*   **Instructor:** Usually follows the room.

## iCalendar (.ics) Generation Requirements
To avoid having to calculate every single date in JavaScript, use the iCalendar format with `RRULE` (recurrence rules).

### Event Mapping:
*   **SUMMARY:** [Course Code] [Component] (e.g., "SYDE 212 LEC" or "SYDE 212 - Probability, Stats & Data Sci")
*   **LOCATION:** Room (e.g., "E7 4433")
*   **DESCRIPTION:** Instructor Name and Component Type
*   **DTSTART:** The first occurrence of the specific weekday *on or after* the start date. (e.g., if the start date is 09/09/2026 which is a Wednesday, but the class is on Thursday, DTSTART must be calculated as 09/10/2026 combined with the start time).
*   **DTEND:** Same date as DTSTART, combined with the end time.
*   **RRULE:** `FREQ=WEEKLY;BYDAY=[MO/TU/WE/TH/FR];UNTIL=[End Date formatted as YYYYMMDDTHHMMSSZ]`

### .ics Formatting Rules:
*   Lines must be separated by `\r\n`.
*   Dates/Times must be in ISO 8601 basic format (e.g., `20260909T103000`).
*   Ensure timezones are handled correctly (Waterloo is America/Toronto, EDT/EST). For simplicity, you can format times as floating times (without the 'Z' suffix) so they attach to the user's local calendar timezone, or explicitly define the `TZID=America/Toronto`.

## Edge Cases to Handle
1.  **TBA/Missing Info:** Some classes have "TBA" for room or instructor. The parser shouldn't break.
2.  **Multi-Day Blocks:** A string like `TTh 9:00AM - 10:20AM` means Tuesday AND Thursday. This should create two separate events or a single event with `RRULE:FREQ=WEEKLY;BYDAY=TU,TH`.
3.  **Online Classes:** Might lack a physical room.

## Testing Data
Use the following text as your primary test case to ensure the parser works perfectly before finalizing the logic:
(Ensure the developer inputs the sample text provided in the user prompt).
