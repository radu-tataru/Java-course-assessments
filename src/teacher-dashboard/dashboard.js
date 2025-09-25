/**
 * Teacher Dashboard JavaScript
 * Manages the teacher interface for viewing student progress and analytics
 */

class TeacherDashboard {
    constructor() {
        this.studentData = [];
        this.submissionData = [];
        this.charts = {};
        this.currentSection = 'overview';

        this.init();
    }

    init() {
        this.loadData();
        this.setupNavigation();
        this.setupEventListeners();
        this.refreshDashboard();
    }

    /**
     * Load data from localStorage
     */
    loadData() {
        try {
            // Load submissions
            const submissions = localStorage.getItem(CONFIG.STORAGE_KEYS.SUBMISSIONS);
            this.submissionData = submissions ? JSON.parse(submissions) : [];

            // Process student data from submissions
            this.processStudentData();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    /**
     * Process submissions into student-centric data
     */
    processStudentData() {
        const studentMap = new Map();

        this.submissionData.forEach(submission => {
            const studentId = submission.studentId;

            if (!studentMap.has(studentId)) {
                studentMap.set(studentId, {
                    studentId: studentId,
                    submissions: [],
                    totalScore: 0,
                    completedSteps: new Set(),
                    lastActivity: null,
                    averageScore: 0
                });
            }

            const student = studentMap.get(studentId);
            student.submissions.push(submission);
            student.completedSteps.add(submission.stepNumber);

            const submissionDate = new Date(submission.timestamp);
            if (!student.lastActivity || submissionDate > new Date(student.lastActivity)) {
                student.lastActivity = submission.timestamp;
            }
        });

        // Calculate averages
        studentMap.forEach(student => {
            if (student.submissions.length > 0) {
                const totalScore = student.submissions.reduce((sum, sub) => sum + sub.results.percentage, 0);
                student.averageScore = Math.round(totalScore / student.submissions.length);
            }
        });

        this.studentData = Array.from(studentMap.values());
    }

    /**
     * Setup navigation
     */
    setupNavigation() {
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // Update active state
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Show/hide sections
                const sectionName = link.getAttribute('data-section');
                this.showSection(sectionName);
            });
        });
    }

    /**
     * Show specific dashboard section
     */
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentSection = sectionName;

            // Load section-specific content
            this.loadSectionContent(sectionName);
        }
    }

    /**
     * Load content for specific section
     */
    loadSectionContent(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.loadOverview();
                break;
            case 'students':
                this.loadStudents();
                break;
            case 'assessments':
                this.loadAssessments();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'questions':
                this.loadQuestions();
                break;
            case 'export':
                this.loadExport();
                break;
        }
    }

    /**
     * Load overview section
     */
    loadOverview() {
        // Update statistics
        this.updateStatistics();

        // Load recent activity
        this.loadRecentActivity();
    }

    /**
     * Update dashboard statistics
     */
    updateStatistics() {
        const totalStudents = this.studentData.length;
        const completedAssessments = this.submissionData.length;

        let totalScore = 0;
        let passingCount = 0;

        this.submissionData.forEach(submission => {
            totalScore += submission.results.percentage;
            if (submission.results.passed) {
                passingCount++;
            }
        });

        const averageScore = completedAssessments > 0 ? Math.round(totalScore / completedAssessments) : 0;
        const passingRate = completedAssessments > 0 ? Math.round((passingCount / completedAssessments) * 100) : 0;

        // Update DOM
        document.getElementById('total-students').textContent = totalStudents;
        document.getElementById('completed-assessments').textContent = completedAssessments;
        document.getElementById('average-score').textContent = `${averageScore}%`;
        document.getElementById('passing-rate').textContent = `${passingRate}%`;
    }

    /**
     * Load recent activity
     */
    loadRecentActivity() {
        const container = document.getElementById('recent-activity');

        // Sort submissions by timestamp (most recent first)
        const recentSubmissions = [...this.submissionData]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        let html = '';

        if (recentSubmissions.length === 0) {
            html = '<div class="text-center text-muted p-4">No recent activity</div>';
        } else {
            recentSubmissions.forEach(submission => {
                const date = new Date(submission.timestamp);
                const timeAgo = this.getTimeAgo(date);
                const statusClass = submission.results.passed ? 'success' : 'danger';
                const statusIcon = submission.results.passed ? 'check-circle' : 'x-circle';

                html += `
                    <div class="d-flex align-items-center justify-content-between p-2 border-bottom">
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                <i class="bi bi-${statusIcon} text-${statusClass}"></i>
                            </div>
                            <div>
                                <div class="fw-semibold">${submission.studentId}</div>
                                <div class="small text-muted">Step ${submission.stepNumber} - ${submission.results.percentage}%</div>
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="small text-muted">${timeAgo}</div>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    }

    /**
     * Load students section
     */
    loadStudents() {
        const tbody = document.getElementById('students-table-body');
        let html = '';

        if (this.studentData.length === 0) {
            html = '<tr><td colspan="6" class="text-center text-muted p-4">No student data available</td></tr>';
        } else {
            this.studentData.forEach(student => {
                const latestStep = Math.max(...Array.from(student.completedSteps));
                const progressPercentage = Math.round((student.completedSteps.size / CONFIG.COURSE.TOTAL_STEPS) * 100);
                const lastActivity = this.getTimeAgo(new Date(student.lastActivity));

                html += `
                    <tr>
                        <td>
                            <div class="fw-semibold">${student.studentId}</div>
                        </td>
                        <td>
                            <span class="badge badge-step">Step ${latestStep}</span>
                        </td>
                        <td>
                            <div class="progress-bar-container">
                                <div class="bg-success" style="width: ${progressPercentage}%; height: 100%;"></div>
                            </div>
                            <small class="text-muted">${progressPercentage}%</small>
                        </td>
                        <td>
                            <span class="fw-semibold ${student.averageScore >= CONFIG.COURSE.PASSING_SCORE ? 'text-success' : 'text-danger'}">
                                ${student.averageScore}%
                            </span>
                        </td>
                        <td>
                            <small class="text-muted">${lastActivity}</small>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="dashboard.viewStudentDetail('${student.studentId}')">
                                <i class="bi bi-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
    }

    /**
     * Load assessments section
     */
    loadAssessments() {
        // Setup step filter options
        this.setupStepFilter();

        // Create charts
        this.createStepDistributionChart();
        this.createScoreDistributionChart();

        // Load assessment table
        this.loadAssessmentTable();
    }

    /**
     * Setup step filter dropdown
     */
    setupStepFilter() {
        const stepFilter = document.getElementById('step-filter');
        const questionStepFilter = document.getElementById('question-step-filter');

        let html = '<option value="">All Steps</option>';
        for (let i = 1; i <= CONFIG.COURSE.TOTAL_STEPS; i++) {
            html += `<option value="${i}">Step ${i}</option>`;
        }

        if (stepFilter) stepFilter.innerHTML = html;
        if (questionStepFilter) questionStepFilter.innerHTML = html;

        // Add event listeners for filtering
        if (stepFilter) {
            stepFilter.addEventListener('change', () => this.filterAssessments());
        }

        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterAssessments());
        }
    }

    /**
     * Create step distribution chart
     */
    createStepDistributionChart() {
        const ctx = document.getElementById('step-distribution-chart');
        if (!ctx) return;

        // Count submissions by step
        const stepCounts = {};
        for (let i = 1; i <= CONFIG.COURSE.TOTAL_STEPS; i++) {
            stepCounts[i] = 0;
        }

        this.submissionData.forEach(submission => {
            if (stepCounts[submission.stepNumber] !== undefined) {
                stepCounts[submission.stepNumber]++;
            }
        });

        const data = {
            labels: Object.keys(stepCounts).map(step => `Step ${step}`),
            datasets: [{
                data: Object.values(stepCounts),
                backgroundColor: [
                    '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                    '#06b6d4', '#84cc16', '#f97316', '#ec4899'
                ]
            }]
        };

        this.charts.stepDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    /**
     * Create score distribution chart
     */
    createScoreDistributionChart() {
        const ctx = document.getElementById('score-distribution-chart');
        if (!ctx) return;

        // Create score ranges
        const ranges = {
            '0-20%': 0,
            '21-40%': 0,
            '41-60%': 0,
            '61-80%': 0,
            '81-100%': 0
        };

        this.submissionData.forEach(submission => {
            const score = submission.results.percentage;
            if (score <= 20) ranges['0-20%']++;
            else if (score <= 40) ranges['21-40%']++;
            else if (score <= 60) ranges['41-60%']++;
            else if (score <= 80) ranges['61-80%']++;
            else ranges['81-100%']++;
        });

        this.charts.scoreDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(ranges),
                datasets: [{
                    label: 'Number of Submissions',
                    data: Object.values(ranges),
                    backgroundColor: '#2563eb',
                    borderColor: '#1d4ed8',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    /**
     * Load assessment table
     */
    loadAssessmentTable() {
        const tbody = document.getElementById('assessments-table-body');
        let html = '';

        if (this.submissionData.length === 0) {
            html = '<tr><td colspan="7" class="text-center text-muted p-4">No assessment submissions</td></tr>';
        } else {
            const sortedSubmissions = [...this.submissionData]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            sortedSubmissions.forEach(submission => {
                const date = new Date(submission.timestamp);
                const duration = this.formatDuration(submission.results.duration);
                const statusClass = submission.results.passed ? 'success' : 'danger';
                const statusText = submission.results.passed ? 'Passed' : 'Failed';

                html += `
                    <tr>
                        <td>${submission.studentId}</td>
                        <td><span class="badge badge-step">Step ${submission.stepNumber}</span></td>
                        <td>
                            <span class="fw-semibold ${submission.results.percentage >= CONFIG.COURSE.PASSING_SCORE ? 'text-success' : 'text-danger'}">
                                ${submission.results.percentage}%
                            </span>
                        </td>
                        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                        <td>${duration}</td>
                        <td>${date.toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="dashboard.viewSubmissionDetail('${submission.timestamp}')">
                                <i class="bi bi-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html;
    }

    /**
     * Filter assessments based on selected criteria
     */
    filterAssessments() {
        const stepFilter = document.getElementById('step-filter').value;
        const statusFilter = document.getElementById('status-filter').value;

        // Get all table rows
        const rows = document.querySelectorAll('#assessments-table-body tr');

        rows.forEach(row => {
            let showRow = true;

            // Step filter
            if (stepFilter) {
                const stepBadge = row.querySelector('.badge-step');
                if (!stepBadge || !stepBadge.textContent.includes(stepFilter)) {
                    showRow = false;
                }
            }

            // Status filter
            if (statusFilter && showRow) {
                const statusBadge = row.querySelector('.badge.bg-success, .badge.bg-danger');
                if (!statusBadge) {
                    showRow = false;
                } else {
                    const isPassedRow = statusBadge.classList.contains('bg-success');
                    if ((statusFilter === 'passed' && !isPassedRow) ||
                        (statusFilter === 'failed' && isPassedRow)) {
                        showRow = false;
                    }
                }
            }

            row.style.display = showRow ? '' : 'none';
        });
    }

    /**
     * Load analytics section
     */
    loadAnalytics() {
        this.createPerformanceTrendsChart();
        this.createQuestionTypeChart();
        this.createTimeAnalysisChart();
        this.loadCommonMistakes();
    }

    /**
     * Create performance trends chart
     */
    createPerformanceTrendsChart() {
        const ctx = document.getElementById('performance-trends-chart');
        if (!ctx) return;

        // Group submissions by step and calculate average scores
        const stepAverages = {};
        const stepCounts = {};

        this.submissionData.forEach(submission => {
            const step = submission.stepNumber;
            if (!stepAverages[step]) {
                stepAverages[step] = 0;
                stepCounts[step] = 0;
            }
            stepAverages[step] += submission.results.percentage;
            stepCounts[step]++;
        });

        // Calculate averages
        const labels = [];
        const data = [];

        for (let step = 1; step <= CONFIG.COURSE.TOTAL_STEPS; step++) {
            labels.push(`Step ${step}`);
            if (stepCounts[step]) {
                data.push(Math.round(stepAverages[step] / stepCounts[step]));
            } else {
                data.push(0);
            }
        }

        this.charts.performanceTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Score',
                    data: data,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    /**
     * Create question type performance chart
     */
    createQuestionTypeChart() {
        const ctx = document.getElementById('question-type-chart');
        if (!ctx) return;

        // This would need to be populated with actual question type performance data
        // For now, showing placeholder data
        const questionTypes = ['Multiple Choice', 'Code Reading', 'Code Completion', 'Coding Challenge'];
        const performanceData = [85, 78, 65, 72]; // Placeholder percentages

        this.charts.questionType = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: questionTypes,
                datasets: [{
                    label: 'Success Rate %',
                    data: performanceData,
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderColor: '#2563eb',
                    pointBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    /**
     * Create time analysis chart
     */
    createTimeAnalysisChart() {
        const ctx = document.getElementById('time-analysis-chart');
        if (!ctx) return;

        // Analyze time spent per step
        const stepTimes = {};
        const stepCounts = {};

        this.submissionData.forEach(submission => {
            const step = submission.stepNumber;
            const timeInMinutes = submission.results.duration / (1000 * 60);

            if (!stepTimes[step]) {
                stepTimes[step] = 0;
                stepCounts[step] = 0;
            }
            stepTimes[step] += timeInMinutes;
            stepCounts[step]++;
        });

        const labels = [];
        const avgTimes = [];
        const maxTimes = [];

        for (let step = 1; step <= CONFIG.COURSE.TOTAL_STEPS; step++) {
            labels.push(`Step ${step}`);
            if (stepCounts[step]) {
                avgTimes.push(Math.round(stepTimes[step] / stepCounts[step]));
                // For max times, we'd need to track individual max times per step
                maxTimes.push(Math.round(avgTimes[avgTimes.length - 1] * 1.5)); // Approximate
            } else {
                avgTimes.push(0);
                maxTimes.push(0);
            }
        }

        this.charts.timeAnalysis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Average Time (minutes)',
                        data: avgTimes,
                        backgroundColor: 'rgba(37, 99, 235, 0.7)'
                    },
                    {
                        label: 'Typical Range (minutes)',
                        data: maxTimes,
                        backgroundColor: 'rgba(16, 185, 129, 0.5)'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Load common mistakes analysis
     */
    loadCommonMistakes() {
        const container = document.getElementById('common-mistakes-list');

        // This would be populated with actual mistake analysis
        // For now, showing placeholder data
        const commonMistakes = [
            { mistake: 'Forgetting semicolons', frequency: 45 },
            { mistake: 'Incorrect variable naming', frequency: 38 },
            { mistake: 'Missing import statements', frequency: 32 },
            { mistake: 'Incorrect loop syntax', frequency: 28 },
            { mistake: 'Wrong access modifiers', frequency: 22 }
        ];

        let html = '<div class="list-group list-group-flush">';

        commonMistakes.forEach((mistake, index) => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-semibold">${mistake.mistake}</div>
                        <small class="text-muted">#${index + 1} most common</small>
                    </div>
                    <span class="badge bg-danger rounded-pill">${mistake.frequency}%</span>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Export functionality
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-export-csv]')) {
                this.exportCSV();
            } else if (e.target.matches('[data-export-pdf]')) {
                this.exportPDF();
            } else if (e.target.matches('[data-generate-report]')) {
                this.generateReport();
            }
        });

        // Auto-refresh data every 30 seconds
        setInterval(() => {
            this.loadData();
            if (this.currentSection === 'overview') {
                this.updateStatistics();
                this.loadRecentActivity();
            }
        }, 30000);
    }

    /**
     * Refresh entire dashboard
     */
    refreshDashboard() {
        this.loadData();
        this.loadSectionContent(this.currentSection);
    }

    /**
     * Export data as CSV
     */
    exportCSV() {
        const headers = ['Student ID', 'Step', 'Score', 'Status', 'Duration', 'Timestamp'];
        let csvContent = headers.join(',') + '\n';

        this.submissionData.forEach(submission => {
            const row = [
                submission.studentId,
                submission.stepNumber,
                submission.results.percentage,
                submission.results.passed ? 'Passed' : 'Failed',
                this.formatDuration(submission.results.duration),
                submission.timestamp
            ];
            csvContent += row.join(',') + '\n';
        });

        this.downloadFile('assessment-data.csv', csvContent, 'text/csv');
    }

    /**
     * Export data as PDF
     */
    exportPDF() {
        // This would integrate with a PDF generation library
        alert('PDF export functionality would be implemented with a library like jsPDF');
    }

    /**
     * Generate analytics report
     */
    generateReport() {
        const reportType = document.getElementById('report-type').value;
        alert(`Generating ${reportType} report...`);
    }

    /**
     * View detailed student information
     */
    viewStudentDetail(studentId) {
        const student = this.studentData.find(s => s.studentId === studentId);
        if (!student) return;

        // Create modal or navigate to detail view
        alert(`Viewing details for ${studentId}\nAverage Score: ${student.averageScore}%\nCompleted Steps: ${student.completedSteps.size}`);
    }

    /**
     * View detailed submission information
     */
    viewSubmissionDetail(timestamp) {
        const submission = this.submissionData.find(s => s.timestamp === timestamp);
        if (!submission) return;

        // Create modal or navigate to detail view
        alert(`Viewing submission details:\nStudent: ${submission.studentId}\nStep: ${submission.stepNumber}\nScore: ${submission.results.percentage}%`);
    }

    // Utility methods
    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }

    formatDuration(milliseconds) {
        if (!milliseconds) return '0:00';
        const minutes = Math.floor(milliseconds / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    showError(message) {
        console.error(message);
        // Could show toast notification or modal
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new TeacherDashboard();
});