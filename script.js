document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const downloadAgainBtn = document.getElementById('download-again-btn');
    const pasteClipboardBtn = document.getElementById('paste-clipboard-btn');
    const loadSampleBtn = document.getElementById('load-sample-btn');
    const clearBtn = document.getElementById('clear-btn');
    const scheduleInput = document.getElementById('schedule-input');
    const statusMessage = document.getElementById('status-message');
    const previewSection = document.getElementById('preview-section');
    const instructions = document.getElementById('instructions');
    const scheduleTbody = document.getElementById('schedule-tbody');
    const eventCountSpan = document.getElementById('event-count');
    const calendarGrid = document.getElementById('calendar-grid');

    const tabGridBtn = document.getElementById('tab-grid-btn');
    const tabTableBtn = document.getElementById('tab-table-btn');
    const gridViewContainer = document.getElementById('grid-view-container');
    const tableViewContainer = document.getElementById('table-view-container');

    let currentIcsContent = null;
    let parsedEvents = [];

    const toggleGuideBtn = document.getElementById('toggle-guide-btn');
    const guideContent = document.getElementById('guide-content');

    // Visual Guide Accordion Toggle
    if (toggleGuideBtn && guideContent) {
        toggleGuideBtn.addEventListener('click', () => {
            const isHidden = guideContent.classList.contains('hidden');
            if (isHidden) {
                guideContent.classList.remove('hidden');
                toggleGuideBtn.classList.add('open');
            } else {
                guideContent.classList.add('hidden');
                toggleGuideBtn.classList.remove('open');
            }
        });
    }

    // Tab Switching
    if (tabGridBtn && tabTableBtn) {
        tabGridBtn.addEventListener('click', () => {
            tabGridBtn.classList.add('active');
            tabTableBtn.classList.remove('active');
            gridViewContainer.classList.remove('hidden');
            tableViewContainer.classList.add('hidden');
        });

        tabTableBtn.addEventListener('click', () => {
            tabTableBtn.classList.add('active');
            tabGridBtn.classList.remove('active');
            tableViewContainer.classList.remove('hidden');
            gridViewContainer.classList.add('hidden');
        });
    }

    // Quick Paste from Clipboard
    if (pasteClipboardBtn) {
        pasteClipboardBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    scheduleInput.value = text;
                    showStatus('Pasted from clipboard! Click "Generate Calendar File" below.', 'success');
                }
            } catch (err) {
                scheduleInput.focus();
                showStatus('Press Ctrl+V (or Cmd+V) to paste your schedule.', 'error');
            }
        });
    }

    // Load Randomized Sample Schedule
    if (loadSampleBtn) {
        loadSampleBtn.addEventListener('click', () => {
            scheduleInput.value = getRandomizedSampleSchedule();
            showStatus('🎲 Generated an anonymized sample schedule! Click "Generate Calendar File" to test.', 'success');
        });
    }

    // Clear Button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            scheduleInput.value = '';
            previewSection.classList.add('hidden');
            instructions.classList.add('hidden');
            statusMessage.classList.add('hidden');
        });
    }

    // Generate Calendar File
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const text = scheduleInput.value;
            if (!text || !text.trim()) {
                showStatus('Please paste your Quest schedule in the box above.', 'error');
                return;
            }

            try {
                parsedEvents = parseSchedule(text);
                if (parsedEvents.length === 0) {
                    showStatus('No classes found in the provided text. Please ensure you copied your entire schedule from Quest.', 'error');
                    previewSection.classList.add('hidden');
                    instructions.classList.add('hidden');
                    return;
                }

                // Render both views
                renderTableView(parsedEvents);
                renderGridView(parsedEvents);

                // Generate ICS file
                currentIcsContent = generateICS(parsedEvents);
                try {
                    downloadICS(currentIcsContent, 'quest_schedule.ics');
                } catch (dlErr) {
                    console.warn('Auto download blocked:', dlErr);
                }

                const uniqueCourses = [...new Set(parsedEvents.map(e => e.courseCode))];
                showStatus(`✨ Success! Parsed ${uniqueCourses.length} course(s) and ${parsedEvents.length} weekly class session(s). Your .ics file is downloading.`, 'success');
                
                previewSection.classList.remove('hidden');
                instructions.classList.remove('hidden');

                // Smooth scroll to preview
                previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (error) {
                console.error('Parsing error:', error);
                showStatus('An error occurred while parsing: ' + error.message, 'error');
            }
        });
    }

    // Download Again Button
    if (downloadAgainBtn) {
        downloadAgainBtn.addEventListener('click', () => {
            if (currentIcsContent) {
                downloadICS(currentIcsContent, 'quest_schedule.ics');
            }
        });
    }

    function renderTableView(events) {
        scheduleTbody.innerHTML = '';
        eventCountSpan.textContent = events.length;

        events.forEach(evt => {
            const tr = document.createElement('tr');
            const compClass = getCompClass(evt.component);
            tr.innerHTML = `
                <td><strong>${escapeHtml(evt.courseCode)}</strong><br><small style="color:#94A3B8">${escapeHtml(evt.courseName)}</small></td>
                <td><span class="component-tag ${compClass}">${escapeHtml(evt.component)}</span></td>
                <td><strong style="color:#F59E0B">${escapeHtml(evt.daysRaw)}</strong> ${escapeHtml(evt.startTime)} - ${escapeHtml(evt.endTime)}</td>
                <td>${escapeHtml(evt.room)}</td>
                <td>${escapeHtml(evt.instructor)}</td>
                <td><small>${escapeHtml(evt.startDate)} - ${escapeHtml(evt.endDate)}</small></td>
            `;
            scheduleTbody.appendChild(tr);
        });
    }

    function renderGridView(events) {
        if (!calendarGrid) return;
        calendarGrid.innerHTML = '';

        const days = [
            { key: 'MO', label: 'Monday' },
            { key: 'TU', label: 'Tuesday' },
            { key: 'WE', label: 'Wednesday' },
            { key: 'TH', label: 'Thursday' },
            { key: 'FR', label: 'Friday' }
        ];

        // Create Day Columns
        days.forEach(day => {
            const col = document.createElement('div');
            col.className = 'grid-day-col';

            const header = document.createElement('div');
            header.className = 'grid-header-cell';
            header.textContent = day.label;
            col.appendChild(header);

            // Filter events that occur on this day
            const dayEvents = events.filter(e => e.days.includes(day.key));
            
            // Sort chronologically by start time
            dayEvents.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            if (dayEvents.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = '#475569';
                empty.style.fontSize = '0.75rem';
                empty.style.textAlign = 'center';
                empty.style.padding = '1.5rem 0.5rem';
                empty.textContent = 'No classes';
                col.appendChild(empty);
            } else {
                dayEvents.forEach(e => {
                    const card = document.createElement('div');
                    const compClass = getCompClass(e.component);
                    card.className = `class-card ${compClass}`;
                    card.innerHTML = `
                        <div class="class-card-header">
                            <span class="class-code">${escapeHtml(e.courseCode)}</span>
                            <span class="class-badge">${escapeHtml(e.component)}</span>
                        </div>
                        <div class="class-time">⏰ ${escapeHtml(e.startTime)} - ${escapeHtml(e.endTime)}</div>
                        <div class="class-room">📍 ${escapeHtml(e.room)}</div>
                        <div class="class-prof">👤 ${escapeHtml(e.instructor)}</div>
                    `;
                    col.appendChild(card);
                });
            }

            calendarGrid.appendChild(col);
        });
    }

    function getCompClass(comp) {
        const c = String(comp).toUpperCase();
        if (c.includes('LEC')) return 'lec';
        if (c.includes('TUT')) return 'tut';
        if (c.includes('LAB')) return 'lab';
        if (c.includes('SEM')) return 'sem';
        return 'lec';
    }

    function timeToMinutes(timeStr) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})([AP]M)/i);
        if (!match) return 0;
        let hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + mins;
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

    let cleaned = text
        .replace(/[\u00A0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
        .replace(/[–—−‐]/g, '-');

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

    const timeRegex = /^((?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Mo|Tu|We|Th|Fr|Sa|Su|M|T|W|F)[,\s/]*)+)\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)$/i;
    const courseRegex = /^\s*([A-Z]{2,6}\s+\d{1,4}[A-Z]?)(?:\s*-\s*(.*?)(?:\s*Status.*|\t.*)?|\s*Status.*)$/i;
    const componentRegex = /^(LEC|TUT|LAB|SEM|TST|PRJ|STU|CLN|WSP|EXM|RDG|PRA|THE|DIS|FLD)$/i;
    const datesRegex = /^(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*-\s*(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4})$/;

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // 1. Time Block Check (Priority)
        const timeMatch = line.match(timeRegex);
        if (timeMatch && currentCourseCode) {
            const daysStr = timeMatch[1].trim();
            const startTimeStr = timeMatch[2].replace(/\s+/g, '').toUpperCase();
            const endTimeStr = timeMatch[3].replace(/\s+/g, '').toUpperCase();

            let room = 'TBA';
            let instructor = 'TBA';
            let startDateStr = null;
            let endDateStr = null;

            const lookAheadLimit = Math.min(i + 6, lines.length);
            for (let j = i + 1; j < lookAheadLimit; j++) {
                const peekLine = lines[j];
                const datesMatch = peekLine.match(datesRegex);
                if (datesMatch) {
                    startDateStr = datesMatch[1];
                    endDateStr = datesMatch[2];

                    if (j > i + 1 && !lines[i + 1].match(datesRegex) && !lines[i + 1].match(timeRegex) && !lines[i + 1].match(componentRegex) && !lines[i + 1].match(courseRegex)) {
                        room = lines[i + 1];
                    }
                    if (j > i + 2 && !lines[i + 2].match(datesRegex) && !lines[i + 2].match(timeRegex) && !lines[i + 2].match(componentRegex) && !lines[i + 2].match(courseRegex)) {
                        instructor = lines[i + 2];
                    }

                    i = j;
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
            i++;
            continue;
        }

        // 2. Component Tag Check
        const componentMatch = line.match(componentRegex);
        if (componentMatch) {
            currentComponent = componentMatch[1].toUpperCase();
            i++;
            continue;
        }

        // 3. Course Header Check
        const courseMatch = line.match(courseRegex);
        if (courseMatch) {
            currentCourseCode = courseMatch[1].trim();
            const rawTitle = courseMatch[2] ? courseMatch[2] : currentCourseCode;
            currentCourseName = rawTitle.replace(/Status.*$/i, '').trim();
            currentComponent = null;
            i++;
            continue;
        }

        i++;
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
        'PRODID:-//University of Waterloo//Quest Schedule Exporter//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Quest Class Schedule',
        'X-WR-TIMEZONE:America/Toronto',
        'BEGIN:VTIMEZONE',
        'TZID:America/Toronto',
        'X-LIC-LOCATION:America/Toronto',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:-0500',
        'TZOFFSETTO:-0400',
        'TZNAME:EDT',
        'DTSTART:19700308T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:-0400',
        'TZOFFSETTO:-0500',
        'TZNAME:EST',
        'DTSTART:19701101T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
        'END:STANDARD',
        'END:VTIMEZONE'
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
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
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
    }, 150);
}

// Generates a completely randomized, anonymized sample Waterloo schedule
function getRandomizedSampleSchedule() {
    const coursePool = [
        { code: 'CS 135', name: 'Designing Functional Programs' },
        { code: 'MATH 137', name: 'Calculus 1 for Honours Mathematics' },
        { code: 'MATH 135', name: 'Algebra for Honours Mathematics' },
        { code: 'ECE 105', name: 'Classical Mechanics' },
        { code: 'SE 101', name: 'Introduction to Software Engineering' },
        { code: 'PHYS 121', name: 'Mechanics and Waves' },
        { code: 'STAT 230', name: 'Probability & Statistics' },
        { code: 'ENGL 109', name: 'Academic Writing & Communication' },
        { code: 'ECON 101', name: 'Introduction to Microeconomics' },
        { code: 'CHEM 120', name: 'General Chemistry 1' }
    ];

    const instructorPool = [
        'Alex Smith', 'Jordan Taylor', 'Morgan Lee', 
        'Casey Chen', 'Taylor Patel', 'Sam Rivera', 
        'Riley Johnson', 'Jamie Williams', 'Avery Davis'
    ];

    const roomPool = [
        'MC 2065', 'DC 1350', 'STC 1012', 'E7 2005', 
        'E5 2004', 'RCH 101', 'AL 116', 'PHY 145', 'QNC 1501'
    ];

    const timeSlots = [
        { lec: 'MWF 9:30AM - 10:20AM', tut: 'T 1:30PM - 2:20PM' },
        { lec: 'TTh 10:00AM - 11:20AM', tut: 'W 3:30PM - 4:20PM' },
        { lec: 'MWF 11:30AM - 12:20PM', tut: 'Th 4:30PM - 5:20PM' },
        { lec: 'MW 1:30PM - 2:50PM', tut: 'F 8:30AM - 9:20AM' },
        { lec: 'TTh 2:30PM - 3:50PM', tut: 'M 4:30PM - 5:20PM' }
    ];

    // Pick 4 random distinct courses
    const shuffledCourses = [...coursePool].sort(() => 0.5 - Math.random()).slice(0, 4);
    const shuffledInstructors = [...instructorPool].sort(() => 0.5 - Math.random());
    const shuffledRooms = [...roomPool].sort(() => 0.5 - Math.random());

    const lines = [];

    shuffledCourses.forEach((course, idx) => {
        const prof = shuffledInstructors[idx % shuffledInstructors.length];
        const room = shuffledRooms[idx % shuffledRooms.length];
        const times = timeSlots[idx % timeSlots.length];
        const lecNum = Math.floor(4000 + Math.random() * 5000);
        const tutNum = Math.floor(4000 + Math.random() * 5000);

        lines.push(`${course.code} - ${course.name}`);
        lines.push('Status\tUnits\tGrading\tGrade\tDeadlines');
        lines.push('Enrolled\t0.50\tNumeric Grading Basis\tAcademic Calendar Deadlines');
        lines.push('Class Nbr\tSection\tComponent\tDays & Times\tRoom\tInstructor\tStart/End Date');
        lines.push(`${lecNum}\t001\tLEC\t${times.lec}\t${room}\t${prof}\t09/09/2026 - 12/08/2026`);
        lines.push(`${tutNum}\t101\tTUT\t${times.tut}\t${room}\t${prof}\t09/09/2026 - 12/08/2026\n`);
    });

    return lines.join('\n');
}
