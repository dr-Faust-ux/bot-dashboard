// Инициализация графиков для темной темы
let levelChart = null;
let timeChart = null;

// Цвета для темной темы
const chartColors = {
    background: 'rgba(30, 30, 30, 0.8)',
    grid: 'rgba(100, 100, 100, 0.2)',
    text: '#adb5bd'
};

function initCharts(statistics) {
    const levelCtx = document.getElementById('levelChart').getContext('2d');
    
    // Настройки для Chart.js в темной теме
    Chart.defaults.color = chartColors.text;
    Chart.defaults.borderColor = chartColors.grid;
    
    levelChart = new Chart(levelCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(statistics.by_level),
            datasets: [{
                label: 'Количество логов по уровням',
                data: Object.values(statistics.by_level),
                backgroundColor: [
                    'rgba(108, 117, 125, 0.8)',  // DEBUG
                    'rgba(25, 135, 84, 0.8)',    // INFO
                    'rgba(255, 193, 7, 0.8)',    // WARNING
                    'rgba(220, 53, 69, 0.8)',    // ERROR
                    'rgba(111, 66, 193, 0.8)'    // CRITICAL
                ],
                borderColor: [
                    'rgb(108, 117, 125)',
                    'rgb(25, 135, 84)',
                    'rgb(255, 193, 7)',
                    'rgb(220, 53, 69)',
                    'rgb(111, 66, 193)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartColors.grid
                    }
                },
                x: {
                    grid: {
                        color: chartColors.grid
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: chartColors.text
                    }
                }
            }
        }
    });

    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: Object.keys(statistics.by_hour),
            datasets: [{
                label: 'Количество логов по времени',
                data: Object.values(statistics.by_hour),
                borderColor: 'rgb(13, 110, 253)',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartColors.grid
                    }
                },
                x: {
                    grid: {
                        color: chartColors.grid
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: chartColors.text
                    }
                }
            }
        }
    });
}

function updateCharts(statistics) {
    if (!levelChart || !timeChart) {
        initCharts(statistics);
        return;
    }

    levelChart.data.labels = Object.keys(statistics.by_level);
    levelChart.data.datasets[0].data = Object.values(statistics.by_level);
    levelChart.update();

    timeChart.data.labels = Object.keys(statistics.by_hour);
    timeChart.data.datasets[0].data = Object.values(statistics.by_hour);
    timeChart.update();
}
