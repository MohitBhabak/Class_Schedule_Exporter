document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const scheduleInput = document.getElementById('schedule-input');
    const statusMessage = document.getElementById('status-message');
    const instructions = document.getElementById('instructions');

    generateBtn.addEventListener('click', () => {
        const text = scheduleInput.value;
        if (!text.trim()) {
            showStatus('Please paste your schedule first.', 'error');
            return;
        }

        try {
            const events = parseSchedule(text);
            if (events.length === 0) {
                showStatus('No classes found. Please ensure you copied the schedule correctly.', 'error');
                return;
            }

            const icsContent = generateICS(events);
            downloadICS(icsContent, 'schedule.ics');
            
            showStatus(`Successfully found and generated ${events.length} class event(s)!`, 'success');
            instructions.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            showStatus('An error occurred while parsing the schedule: ' + error.message, 'error');
        }
    });

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type;
        statusMessage.classList.remove('hidden');
    }
});

function parseSchedule(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const events = [];
    
    let currentCourseCode = null;
    let currentCourseName = null;
    let currentComponent = null;

    const courseRegex = /([A-Z]{2,5}\s+\d+[A-Z]?)\s+-\s+(.*?)Status/;
    const componentRegex = /^(LEC|TUT|LAB|SEM|TST|PRJ|STU|CLN|WSP|EXM|RDG)$/i;
    const timeRegex = /^((?:M|T|W|Th|F|Sa|Su)+)\s+(\d{1,2}:\d{2}[AP]M)\s+-\s+(\d{1,2}:\d{2}[AP]M)$/i;
    const datesRegex = /^(\d{2}\/\d{2}\/\d{4})\s+-\s+(\d{2}\/\d{2}\/\d{4})$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match Course Header
        const courseMatch = line.match(courseRegex);
        if (courseMatch) {
            currentCourseCode = courseMatch[1];
            currentCourseName = courseMatch[2];
            currentComponent = null; // reset component
            continue;
        }

        // Match Component
        const componentMatch = line.match(componentRegex);
        if (componentMatch) {
            currentComponent = componentMatch[1];
            continue;
        }

        // Match Time
        const timeMatch = line.match(timeRegex);
        if (timeMatch && currentCourseCode) {
            const daysStr = timeMatch[1];
            const startTimeStr = timeMatch[2];
            const endTimeStr = timeMatch[3];

            // Look ahead for Room, Instructor, Dates
            let room = 'TBA';
            let instructor = 'TBA';
            let startDateStr = null;
            let endDateStr = null;
            
            // Usually the next few lines. We can scan up to 5 lines ahead.
            let lookAheadLimit = Math.min(i + 5, lines.length);
            for (let j = i + 1; j < lookAheadLimit; j++) {
                const peekLine = lines[j];
                const datesMatch = peekLine.match(datesRegex);
                if (datesMatch) {
                    startDateStr = datesMatch[1];
                    endDateStr = datesMatch[2];
                    
                    // Room is typically i+1, Instructor is i+2
                    if (j > i + 1) room = lines[i + 1];
                    if (j > i + 2) instructor = lines[i + 2];
                    
                    i = j; // skip parsed lines
                    break;
                }
            }
            
            if (startDateStr && endDateStr) {
                events.push({
                    courseCode: currentCourseCode,
                    courseName: currentCourseName,
                    component: currentComponent || 'Class',
                    days: parseDays(daysStr),
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

    return events;
}

function parseDays(daysStr) {
    const days = [];
    let str = daysStr;
    if (str.includes('Th')) {
        days.push('TH');
        str = str.replace('Th', '');
    }
    if (str.includes('M')) days.push('MO');
    if (str.includes('T')) days.push('TU');
    if (str.includes('W')) days.push('WE');
    if (str.includes('F')) days.push('FR');
    if (str.includes('Sa')) days.push('SA');
    if (str.includes('Su')) days.push('SU');
    return days;
}

function generateICS(events) {
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Antigravity//Quest Schedule Exporter//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-TIMEZONE:America/Toronto'
    ];

    events.forEach(event => {
        const firstDate = getFirstClassDate(event.startDate, event.days);
        const startDateTime = formatICSDateTime(firstDate, event.startTime);
        const endDateTime = formatICSDateTime(firstDate, event.endTime);
        const untilDate = formatICSDate(event.endDate) + 'T235959Z';
        
        // Basic unique ID
        const uid = `${event.courseCode.replace(/\s+/g, '')}-${startDateTime}@quest.to.calendar`;
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
    const [month, day, year] = dateStr.split('/');
    return new Date(year, month - 1, day);
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
        let current = date.getDay();
        let daysToAdd = (target - current + 7) % 7;
        date.setDate(date.getDate() + daysToAdd);
        
        if (!earliestDate || date < earliestDate) {
            earliestDate = date;
        }
    }
    
    return earliestDate;
}

function formatICSDateTime(date, timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})([AP]M)/);
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3];

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
    const [month, day, year] = dateStr.split('/');
    return `${year}${month}${day}`;
}

function downloadICS(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
