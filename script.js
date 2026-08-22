document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const downloadAgainBtn = document.getElementById('download-again-btn');
    const scheduleInput = document.getElementById('schedule-input');
    const statusMessage = document.getElementById('status-message');
    const previewSection = document.getElementById('preview-section');
    const instructions = document.getElementById('instructions');
    const scheduleTbody = document.getElementById('schedule-tbody');
    const eventCountSpan = document.getElementById('event-count');

    let currentIcsContent = null;

    generateBtn.addEventListener('click', () => {
        const text = scheduleInput.value;
        if (!text.trim()) {
            showStatus('Please paste your schedule in the text box first.', 'error');
            return;
        }

        try {
            const events = parseSchedule(text);
            if (events.length === 0) {
                showStatus('No classes found in the provided text. Please ensure you highlighted and copied your schedule table directly from Quest.', 'error');
                previewSection.classList.add('hidden');
                instructions.classList.add('hidden');
                return;
            }

            // Render preview table
            renderPreview(events);

            // Generate ICS file
            currentIcsContent = generateICS(events);
            downloadICS(currentIcsContent, 'quest_schedule.ics');

            const uniqueCourses = [...new Set(events.map(e => e.courseCode))];
            showStatus(`Success! Parsed ${uniqueCourses.length} course(s) and ${events.length} weekly class session(s). Your .ics file has been downloaded.`, 'success');
            
            previewSection.classList.remove('hidden');
            instructions.classList.remove('hidden');
        } catch (error) {
            console.error('Parsing error:', error);
            showStatus('An error occurred while parsing the schedule: ' + error.message, 'error');
        }
    });

    if (downloadAgainBtn) {
        downloadAgainBtn.addEventListener('click', () => {
            if (currentIcsContent) {
                downloadICS(currentIcsContent, 'quest_schedule.ics');
            }
        });
    }

    function renderPreview(events) {
        scheduleTbody.innerHTML = '';
        eventCountSpan.textContent = events.length;

        events.forEach(evt => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(evt.courseCode)}</strong><br><small style="color:#64748b">${escapeHtml(evt.courseName)}</small></td>
                <td><span class="component-tag">${escapeHtml(evt.component)}</span></td>
                <td>${escapeHtml(evt.daysRaw)} ${escapeHtml(evt.startTime)} - ${escapeHtml(evt.endTime)}</td>
                <td>${escapeHtml(evt.room)}</td>
                <td>${escapeHtml(evt.instructor)}</td>
                <td><small>${escapeHtml(evt.startDate)} - ${escapeHtml(evt.endDate)}</small></td>
            `;
            scheduleTbody.appendChild(tr);
        });
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type;
        statusMessage.classList.remove('hidden');
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function parseSchedule(text) {
    if (!text) return [];

    // Normalize characters (non-breaking spaces, unicode dashes, etc.)
    let cleaned = text
        .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
        .replace(/[–—−‐]/g, '-');

    // Split by lines and tab characters to handle both table paste and plain text copy
    const rawLines = cleaned.split(/[\r\n]+/);
    const lines = [];
    for (const rawLine of rawLines) {
        const parts = rawLine.split('\t');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.length > 0) {
                lines.push(trimmed);
            }
        }
    }

    const events = [];
    let currentCourseCode = null;
    let currentCourseName = null;
    let currentComponent = null;

    // Pattern for course headers (e.g. "SYDE 202 - Seminar", "CS 135 - Introduction to Computer Science", "SYDE 292L - Circuit Lab")
    const courseRegex = /^\s*([A-Z]{2,6}\s+\d{1,4}[A-Z]?)(?:\s*[-:]\s*(.*?))?(?:\s*Status.*|\t.*)?$/i;
    // Pattern for component tags
    const componentRegex = /^(LEC|TUT|LAB|SEM|TST|PRJ|STU|CLN|WSP|EXM|RDG|PRA|THE|DIS|FLD)$/i;
    // Pattern for class time ranges
    const timeRegex = /^((?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Mo|Tu|We|Th|Fr|Sa|Su|M|T|W|F)[,\s/]*)+)\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)$/i;
    // Pattern for date ranges (MM/DD/YYYY - MM/DD/YYYY or YYYY/MM/DD - YYYY/MM/DD)
    const datesRegex = /^(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*-\s*(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4})$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match Course Header
        const courseMatch = line.match(courseRegex);
        if (courseMatch) {
            currentCourseCode = courseMatch[1].trim();
            const rawTitle = courseMatch[2] ? courseMatch[2] : currentCourseCode;
            currentCourseName = rawTitle.replace(/Status.*$/i, '').trim();
            currentComponent = null; // reset component for new course
            continue;
        }

        // Match Component
        const componentMatch = line.match(componentRegex);
        if (componentMatch) {
            currentComponent = componentMatch[1].toUpperCase();
            continue;
        }

        // Match Time Block
        const timeMatch = line.match(timeRegex);
        if (timeMatch && currentCourseCode) {
            const daysStr = timeMatch[1].trim();
            const startTimeStr = timeMatch[2].replace(/\s+/g, '').toUpperCase();
            const endTimeStr = timeMatch[3].replace(/\s+/g, '').toUpperCase();

            let room = 'TBA';
            let instructor = 'TBA';
            let startDateStr = null;
            let endDateStr = null;

            // Look ahead up to 6 lines to gather Room, Instructor, and Dates
            const lookAheadLimit = Math.min(i + 6, lines.length);
            for (let j = i + 1; j < lookAheadLimit; j++) {
                const peekLine = lines[j];
                const datesMatch = peekLine.match(datesRegex);
                if (datesMatch) {
                    startDateStr = datesMatch[1];
                    endDateStr = datesMatch[2];

                    if (j > i + 1 && !lines[i + 1].match(datesRegex) && !lines[i + 1].match(timeRegex) && !lines[i + 1].match(componentRegex)) {
                        room = lines[i + 1];
                    }
                    if (j > i + 2 && !lines[i + 2].match(datesRegex) && !lines[i + 2].match(timeRegex) && !lines[i + 2].match(componentRegex)) {
                        instructor = lines[i + 2];
                    }

                    i = j; // skip parsed block lines
                    break;
                }
            }

            if (startDateStr && endDateStr) {
                const parsedDays = parseDays(daysStr);
                if (parsedDays.length > 0) {
                    events.push({
                        courseCode: currentCourseCode,
                        courseName: currentCourseName,
                        component: currentComponent || 'Class',
                        days: parsedDays,
                        daysRaw: daysStr,
                        startTime: startTimeStr,
                        endTime: endTimeStr,
                        room: room,
                        instructor: instructor,
                        startDate: startDateStr,
                        endDate: endDateStr
                    });
                }
            }
        }
    }

    return events;
}

function parseDays(daysStr) {
    const days = [];
    const cleanStr = daysStr.replace(/[^A-Za-z]/g, '');

    if (/\bMon\b/i.test(daysStr) || /Mo/i.test(daysStr) || /M(?!o)/.test(cleanStr)) {
        days.push('MO');
    }
    if (/\bTue\b/i.test(daysStr) || /Tu/i.test(daysStr) || (/T(?!h)/.test(cleanStr) && (!/Th/i.test(cleanStr) || cleanStr.replace(/Th/gi, '').includes('T')))) {
        days.push('TU');
    }
    if (/\bWed\b/i.test(daysStr) || /W/i.test(cleanStr)) {
        days.push('WE');
    }
    if (/\bThu\b/i.test(daysStr) || /Th/i.test(cleanStr)) {
        days.push('TH');
    }
    if (/\bFri\b/i.test(daysStr) || /F/i.test(cleanStr)) {
        days.push('FR');
    }
    if (/\bSat\b/i.test(daysStr) || /Sa/i.test(cleanStr)) {
        days.push('SA');
    }
    if (/\bSun\b/i.test(daysStr) || /Su/i.test(cleanStr)) {
        days.push('SU');
    }

    return [...new Set(days)];
}

function generateICS(events) {
    const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Antigravity//Quest Schedule Exporter//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-TIMEZONE:America/Toronto'
    ];

    events.forEach((event, idx) => {
        const firstDate = getFirstClassDate(event.startDate, event.days);
        const startDateTime = formatICSDateTime(firstDate, event.startTime);
        const endDateTime = formatICSDateTime(firstDate, event.endTime);
        const untilDate = formatICSDate(event.endDate) + 'T235959Z';

        const randomId = Math.random().toString(36).substring(2, 8);
        const uid = `${event.courseCode.replace(/\s+/g, '')}-${event.component}-${startDateTime}-${idx}-${randomId}@quest.to.calendar`;
        const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        ics.push('BEGIN:VEVENT');
        ics.push(`UID:${uid}`);
        ics.push(`DTSTAMP:${dtStamp}`);
        ics.push(`SUMMARY:${event.courseCode} ${event.component}`);
        ics.push(`LOCATION:${event.room}`);
        ics.push(`DESCRIPTION:${event.courseName}\\nInstructor: ${event.instructor}\\nComponent: ${event.component}`);
        ics.push(`DTSTART;TZID=America/Toronto:${startDateTime}`);
        ics.push(`DTEND;TZID=America/Toronto:${endDateTime}`);

        const byDay = event.days.join(',');
        ics.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilDate}`);
        ics.push('END:VEVENT');
    });

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
}

function parseDate(dateStr) {
    const parts = dateStr.split(/[\/\-]/);
    if (parts[0].length === 4) {
        // YYYY/MM/DD
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    // MM/DD/YYYY
    return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
}

const dayMap = {
    'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
};

function getFirstClassDate(startDateStr, daysArr) {
    const baseDate = parseDate(startDateStr);
    let earliestDate = null;

    for (const day of daysArr) {
        const date = new Date(baseDate.getTime());
        const target = dayMap[day];
        const current = date.getDay();
        const daysToAdd = (target - current + 7) % 7;
        date.setDate(date.getDate() + daysToAdd);

        if (!earliestDate || date < earliestDate) {
            earliestDate = date;
        }
    }

    return earliestDate;
}

function formatICSDateTime(date, timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})([AP]M)/i);
    if (!match) return '20260909T000000';
    
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3].toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const pad = (n) => n.toString().padStart(2, '0');

    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(hours);

    return `${yyyy}${mm}${dd}T${hh}${minutes}00`;
}

function formatICSDate(dateStr) {
    const parts = dateStr.split(/[\/\-]/);
    const pad = (n) => n.toString().padStart(2, '0');
    if (parts[0].length === 4) {
        return `${parts[0]}${pad(parts[1])}${pad(parts[2])}`;
    }
    return `${parts[2]}${pad(parts[0])}${pad(parts[1])}`;
}

function downloadICS(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, 100);
}
