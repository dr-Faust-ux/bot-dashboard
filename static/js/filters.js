// Функция для применения фильтров
async function applyFilters() {
    const level = document.getElementById('levelFilter').value;
    const file = document.getElementById('fileFilter').value;
    const metadataKey = document.getElementById('metadataKeyFilter').value;
    const metadataValue = document.getElementById('metadataValueFilter').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    console.log('Applying filters:', {
        level, file, metadataKey, metadataValue, startDate, endDate
    });
    
    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (file) params.append('file', file);
    if (metadataKey) params.append('metadata_key', metadataKey);
    if (metadataValue) params.append('metadata_value', metadataValue);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    try {
        // Показываем индикатор загрузки
        const tbody = document.querySelector('#logsTable tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        
        const response = await fetch(`/api/logs?${params.toString()}`);
        const data = await response.json();
        console.log("API Response:", data);
        
        // Обновляем таблицу
        tbody.innerHTML = data.logs.map(updateTableRow).join('');
        
        // Обновляем графики
        updateCharts(data.statistics);
        
        // Подсвечиваем синтаксис в новых метаданных
        hljs.highlightAll();
        
        // Если фильтруем по конкретному пользователю, предлагаем показать граф
        if (metadataKey === 'user_id' && metadataValue) {
            const showGraph = confirm('Обнаружены действия пользователя. Хотите посмотреть граф действий?');
            if (showGraph) {
                createUserFlowGraph(data.logs);
                const userFlowModal = new bootstrap.Modal(document.getElementById('userFlowModal'));
                userFlowModal.show();
            }
        }
    } catch (error) {
        console.error('Error applying filters:', error);
        alert('Ошибка при применении фильтров');
    }
}

// Функция для сброса фильтров
function resetFilters() {
    document.getElementById('levelFilter').value = '';
    document.getElementById('fileFilter').value = '';
    document.getElementById('metadataKeyFilter').value = '';
    document.getElementById('metadataValueFilter').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    applyFilters();
}

// Функция для обновления строки таблицы
function updateTableRow(log) {
    const metadata = log.metadata || {};
    const timestamp = new Date(log.timestamp).toLocaleString('ru-RU');
    
    return `
        <tr class="log-entry ${log.level.toLowerCase()}">
            <td class="text-muted">${timestamp}</td>
            <td>
                <span class="badge ${getBadgeClass(log.level)}">
                    ${log.level}
                </span>
            </td>
            <td>${log.name || ''}</td>
            <td>
                <span class="log-message">${log.message}</span>
                ${Object.keys(metadata).length > 0 ? `
                    <button class="btn btn-sm btn-outline-info ms-2" 
                            onclick='toggleMetadata(this, ${JSON.stringify(metadata).replace(/'/g, "\\'")})'
                            title="Показать/скрыть метаданные">
                        <i class="bi bi-info-circle"></i>
                    </button>
                ` : ''}
            </td>
            <td class="text-muted">${log.file || ''}</td>
        </tr>
        ${Object.keys(metadata).length > 0 ? `
            <tr class="metadata-row d-none">
                <td colspan="5">
                    <div class="p-3 bg-dark border-start border-info border-3">
                        <h6 class="mb-2 text-info">Метаданные:</h6>
                        <pre class="mb-0"><code class="metadata-content language-json"></code></pre>
                    </div>
                </td>
            </tr>
        ` : ''}
    `;
}

// Функция для получения класса бейджа
function getBadgeClass(level) {
    const classes = {
        'DEBUG': 'bg-secondary',
        'INFO': 'bg-success',
        'WARNING': 'bg-warning',
        'ERROR': 'bg-danger',
        'CRITICAL': 'bg-primary'
    };
    return classes[level] || 'bg-secondary';
}

// Функция для отображения/скрытия метаданных
function toggleMetadata(button, metadata) {
    console.log("Toggle metadata called with:", metadata);
    const metadataRow = button.closest('tr').nextElementSibling;
    const metadataContent = metadataRow.querySelector('.metadata-content');
    
    if (metadataRow.classList.contains('d-none')) {
        // Показываем метаданные
        metadataContent.textContent = JSON.stringify(metadata, null, 2);
        // Сбрасываем предыдущую подсветку
        metadataContent.removeAttribute('data-highlighted');
        hljs.highlightElement(metadataContent);
        metadataRow.classList.remove('d-none');
        button.classList.add('active');
        button.innerHTML = '<i class="bi bi-info-circle-fill"></i>';
    } else {
        // Скрываем метаданные
        metadataRow.classList.add('d-none');
        button.classList.remove('active');
        button.innerHTML = '<i class="bi bi-info-circle"></i>';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем фильтры
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    // Автоматическое применение фильтров при изменении некоторых полей
    document.getElementById('levelFilter').addEventListener('change', applyFilters);
    document.getElementById('fileFilter').addEventListener('change', applyFilters);
});
