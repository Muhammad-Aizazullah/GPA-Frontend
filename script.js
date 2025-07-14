document.addEventListener('DOMContentLoaded', () => {
    const gpaDisplay = document.getElementById('gpaDisplay');
    const courseList = document.getElementById('courseList');
    const gpaForm = document.getElementById('gpaForm');
    const resetBtn = document.getElementById('resetBtn');
    const notificationArea = document.getElementById('notificationArea'); // Renamed from resultDisplay for consistency and clarity

    // Zaroori Note: Jab aapka backend live ho jaye, toh is API_BASE ko apne live backend ke URL se replace karain.
    // Maslan: const API_BASE = 'https://apka-backend-name.up.railway.app';
    const API_BASE = ''; // Leave blank for same-origin or use full URL if hosted separately

    function showNotification(message, type) {
        notificationArea.textContent = message;
        notificationArea.className = `notification ${type}`;
        notificationArea.style.display = 'block';
        setTimeout(() => {
            notificationArea.style.display = 'none';
        }, 3000); // 3 seconds ke baad notification gayab ho jayega
    }

    async function fetchCourses() {
        try {
            const response = await fetch(`${API_BASE}/courses`);
            if (!response.ok) {
                throw new Error('Courses fetch failed');
            }
            const data = await response.json();

            courseList.innerHTML = '';
            if (data.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'Koi course add nahi kiya gaya.';
                courseList.appendChild(li);
            } else {
                data.forEach(course => {
                    const li = document.createElement('li');
                    li.textContent = `${course.course_name} (${course.credit_hours} cr) - ${course.grade}`;
                    courseList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
            showNotification('Courses load nahi ho sakay.', 'error');
        }
    }

    async function fetchGPA() {
        try {
            // Prior semester GPA and completed credits fields ko target karain
            const priorGPAInput = document.getElementById('priorGPA');
            const completedCreditsInput = document.getElementById('completedCredits');

            // Default values agar input empty ho
            const priorGPA = priorGPAInput ? parseFloat(priorGPAInput.value) || 0 : 0;
            const completedCredits = completedCreditsInput ? parseInt(completedCreditsInput.value) || 0 : 0;

            const response = await fetch(`${API_BASE}/gpa?prior_gpa=${priorGPA}&completed_credits=${completedCredits}`);
            if (!response.ok) {
                throw new Error('GPA fetch failed');
            }
            const data = await response.json();

            gpaDisplay.textContent = `Current GPA: ${data.gpa.toFixed(2)}`;
        } catch (error) {
            console.error('Error fetching GPA:', error);
            showNotification('GPA calculate nahi ho saka.', 'error');
            gpaDisplay.textContent = 'Current GPA: 0.00'; // Fallback display
        }
    }

    gpaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const course = document.getElementById('course').value;
        const credit = document.getElementById('credit').value;
        const grade = document.getElementById('grade').value;

        if (!course || !credit || !grade) {
            showNotification('Meherbani kar ke saare fields fill karain.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/courses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ course, credit, grade })
            });

            const data = await response.json();

            if (response.ok) {
                showNotification(data.message, 'success');
                gpaForm.reset();
                await fetchCourses();
                await fetchGPA();
            } else {
                showNotification(data.error || 'Ek error ho gaya.', 'error');
            }
        } catch (error) {
            console.error('Error adding course:', error);
            showNotification('Course add karte hue error ho gaya.', 'error');
        }
    });

    resetBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE}/reset`, {
                method: 'POST'
            });

            const data = await response.json();

            if (response.ok) {
                showNotification(data.message, 'success');
                await fetchCourses();
                gpaDisplay.textContent = 'Current GPA: 0.00'; // Reset GPA display
                // Reset prior and planning sections if they are visible
                document.getElementById('priorGPA').value = '';
                document.getElementById('completedCredits').value = '';
                document.getElementById('finalGpaResult').textContent = '';
                document.getElementById('currentGPA').value = '';
                document.getElementById('targetGPA').value = '';
                document.getElementById('currentCredits').value = '';
                document.getElementById('additionalCredits').value = '';
                document.getElementById('planningResult').textContent = '';

            } else {
                showNotification(data.error || 'Reset karte hue error ho gaya.', 'error');
            }
        } catch (error) {
            console.error('Error resetting courses:', error);
            showNotification('Courses reset karte hue error ho gaya.', 'error');
        }
    });

    // Toggle visibility for Prior Semester & Final GPA section
    const togglePriorBtn = document.getElementById('togglePriorBtn');
    const priorSemesterSection = document.getElementById('priorSemesterSection');
    const calculateFinalGpaBtn = document.getElementById('calculateFinalGpaBtn');
    const finalGpaResult = document.getElementById('finalGpaResult');

    togglePriorBtn.addEventListener('click', () => {
        priorSemesterSection.classList.toggle('hidden');
        if (!priorSemesterSection.classList.contains('hidden')) {
            // Ensure GPA Planning section is hidden when Prior Semester is shown
            gpaPlanningSection.classList.add('hidden');
        }
    });

    // Calculate Final GPA functionality
    calculateFinalGpaBtn.addEventListener('click', async () => {
        const priorGPA = parseFloat(document.getElementById('priorGPA').value);
        const completedCredits = parseInt(document.getElementById('completedCredits').value);

        if (isNaN(priorGPA) || isNaN(completedCredits) || priorGPA < 0 || completedCredits < 0) {
            finalGpaResult.textContent = 'Invalid input. Please enter valid numbers.';
            return;
        }

        try {
            // Fetch current semester's courses to get their contribution
            const currentCoursesResponse = await fetch(`${API_BASE}/courses`);
            if (!currentCoursesResponse.ok) {
                throw new Error('Failed to fetch current courses for final GPA calculation');
            }
            const currentCourses = await currentCoursesResponse.json();

            let currentSemesterPoints = 0;
            let currentSemesterCredits = 0;

            // Define grade_mapping here as it's not directly accessible from the Flask backend
            const grade_mapping = {
                "A+": 4.0, "A": 4.0, "A-": 3.7,
                "B+": 3.3, "B": 3.0, "B-": 2.7,
                "C+": 2.3, "C": 2.0, "C-": 1.7,
                "D+": 1.3, "D": 1.0, "F": 0.0
            };

            currentCourses.forEach(course => {
                const gradePoint = grade_mapping[course.grade.toUpperCase()];
                if (gradePoint !== undefined) {
                    currentSemesterPoints += gradePoint * course.credit_hours;
                    currentSemesterCredits += course.credit_hours;
                }
            });

            const totalPriorPoints = priorGPA * completedCredits;
            const totalCredits = completedCredits + currentSemesterCredits;
            const totalPoints = totalPriorPoints + currentSemesterPoints;

            if (totalCredits === 0) {
                finalGpaResult.textContent = 'Cannot calculate Final GPA with zero total credits.';
                return;
            }

            const finalGPA = totalPoints / totalCredits;
            finalGpaResult.textContent = `Final GPA: ${finalGPA.toFixed(2)}`;
        } catch (error) {
            console.error('Error calculating final GPA:', error);
            finalGpaResult.textContent = 'Error calculating Final GPA.';
        }
    });


    // Toggle visibility for GPA Planning Calculator section
    const togglePlanningBtn = document.getElementById('togglePlanningBtn');
    const gpaPlanningSection = document.getElementById('gpaPlanningSection');
    const calculateRequiredGpaBtn = document.getElementById('calculateRequiredGpaBtn');
    const planningResult = document.getElementById('planningResult');

    togglePlanningBtn.addEventListener('click', () => {
        gpaPlanningSection.classList.toggle('hidden');
        if (!gpaPlanningSection.classList.contains('hidden')) {
            // Ensure Prior Semester section is hidden when GPA Planning is shown
            priorSemesterSection.classList.add('hidden');
        }
    });

    // Calculate Required GPA functionality
    calculateRequiredGpaBtn.addEventListener('click', () => {
        const currentGPA = parseFloat(document.getElementById('currentGPA').value);
        const targetGPA = parseFloat(document.getElementById('targetGPA').value);
        const currentCredits = parseInt(document.getElementById('currentCredits').value);
        const additionalCredits = parseInt(document.getElementById('additionalCredits').value);

        if (isNaN(currentGPA) || isNaN(targetGPA) || isNaN(currentCredits) || isNaN(additionalCredits) ||
            currentGPA < 0 || targetGPA < 0 || currentCredits < 0 || additionalCredits < 0 ||
            currentGPA > 4 || targetGPA > 4) {
            planningResult.textContent = 'Invalid input. Please enter valid numbers (GPA between 0-4).';
            return;
        }

        if (additionalCredits === 0) {
            planningResult.textContent = 'Additional credits must be greater than 0 for planning.';
            return;
        }

        const currentPoints = currentGPA * currentCredits;
        const totalTargetPoints = targetGPA * (currentCredits + additionalCredits);
        const requiredPointsFromAdditional = totalTargetPoints - currentPoints;

        if (requiredPointsFromAdditional < 0) {
            planningResult.textContent = 'Aapne pehle hi apna target GPA achieve kar liya hai!';
            return;
        }

        const requiredGPA = requiredPointsFromAdditional / additionalCredits;

        if (requiredGPA > 4.0) {
            planningResult.textContent = `Aapko ${additionalCredits} credits mein ${requiredGPA.toFixed(2)} GPA chahiye. Yeh bohot mushkil ya namumkin ho sakta hai.`;
        } else if (requiredGPA < 0) {
             planningResult.textContent = `Aapko ${additionalCredits} credits mein 0.00 GPA chahiye. Aapka target GPA pehle se kam hai.`;
        }
        else {
            planningResult.textContent = `Aapko ${additionalCredits} additional credits mein ${requiredGPA.toFixed(2)} GPA chahiye.`;
        }
    });


    // Initial fetches
    fetchCourses();
    fetchGPA();
});