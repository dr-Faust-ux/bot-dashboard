// Глобальные переменные
let network = null;

// Функция для создания графа пользовательских действий
function createUserFlowGraph(logs) {
    console.log('Creating user flow graph with logs:', logs);
    
    const container = document.getElementById('userFlowGraph');
    if (!container) {
        console.error('User flow graph container not found');
        return;
    }
    
    container.style.backgroundColor = '#1a1a1a';
    
    // Структуры для хранения данных графа
    const modules = new Map();
    const functions = new Map();
    const edges = new Map();
    const moduleCalls = new Map();

    logs.forEach(log => {
        try {
            // Обработка метаданных
            if (typeof log.metadata === 'string') {
                log.metadata = JSON.parse(log.metadata);
            }
            
            if (log.metadata?.call_stack) {
                const callStack = log.metadata.call_stack;
                
                callStack.forEach((call, index) => {
                    const fileName = call.file.split('/').pop();
                    const moduleName = fileName.split('.')[0];
                    
                    // Счетчик вызовов модуля
                    moduleCalls.set(moduleName, (moduleCalls.get(moduleName) || 0) + 1);
                    
                    // Узел модуля
                    if (!modules.has(moduleName)) {
                        modules.set(moduleName, {
                            id: `module_${moduleName}`,
                            label: moduleName,
                            type: 'module'
                        });
                    }
                    
                    // Узел функции
                    const functionId = `${moduleName}_${call.function}`;
                    if (!functions.has(functionId)) {
                        functions.set(functionId, {
                            id: functionId,
                            label: call.function,
                            moduleId: `module_${moduleName}`,
                            messages: []
                        });
                    }
                    
                    // Добавляем сообщение к функции
                    functions.get(functionId).messages.push({
                        message: log.message,
                        level: log.level,
                        metadata: log.metadata
                    });
                    
                    // Ребро между функцией и модулем
                    const moduleEdgeId = `${functionId}->${modules.get(moduleName).id}`;
                    if (!edges.has(moduleEdgeId)) {
                        edges.set(moduleEdgeId, {
                            from: functionId,
                            to: `module_${moduleName}`,
                            arrows: 'to',
                            color: { color: '#666666', hover: '#999999' },
                            width: 1
                        });
                    }
                    
                    // Ребра между функциями
                    if (index < callStack.length - 1) {
                        const nextCall = callStack[index + 1];
                        const nextFileName = nextCall.file.split('/').pop();
                        const nextModuleName = nextFileName.split('.')[0];
                        const nextFunctionId = `${nextModuleName}_${nextCall.function}`;
                        
                        const edgeId = `${functionId}->${nextFunctionId}`;
                        if (!edges.has(edgeId)) {
                            edges.set(edgeId, {
                                from: functionId,
                                to: nextFunctionId,
                                arrows: 'to',
                                color: { color: '#4A4A4A', hover: '#666666' },
                                width: 1,
                                smooth: { type: 'curvedCW', roundness: 0.2 }
                            });
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error processing log entry:', error, log);
        }
    });
    
    // Создаем узлы для визуализации
    const nodes = [];
    
    // Узлы модулей
    modules.forEach((module, moduleName) => {
        const callCount = moduleCalls.get(moduleName) || 1;
        nodes.push({
            id: module.id,
            label: module.label,
            shape: 'dot',
            size: Math.max(30, Math.min(60, Math.log2(callCount) * 15)),
            color: {
                background: '#0d6efd',
                border: '#0a58ca',
                highlight: {
                    background: '#3d8bfd',
                    border: '#0d6efd'
                }
            },
            font: {
                size: 14,
                color: '#FFFFFF',
                face: 'monospace'
            }
        });
    });
    
    // Узлы функций
    functions.forEach(func => {
        nodes.push({
            id: func.id,
            label: func.label,
            shape: 'dot',
            size: 20,
            color: {
                background: '#6c757d',
                border: '#545b62',
                highlight: {
                    background: '#868e96',
                    border: '#6c757d'
                }
            },
            font: {
                size: 12,
                color: '#FFFFFF',
                face: 'monospace'
            },
            messages: func.messages
        });
    });
    
    const data = {
        nodes: nodes,
        edges: Array.from(edges.values())
    };
    
    const options = {
        nodes: {
            shape: 'dot',
            font: {
                size: 12,
                color: '#FFFFFF',
                face: 'monospace'
            }
        },
        edges: {
            smooth: {
                type: 'continuous',
                roundness: 0.5
            }
        },
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -100,
                centralGravity: 0.01,
                springLength: 200,
                springConstant: 0.08,
                damping: 0.4,
                avoidOverlap: 1
            },
            stabilization: {
                enabled: true,
                iterations: 1000,
                updateInterval: 100
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 300,
            hideEdgesOnDrag: true,
            navigationButtons: true,
            keyboard: { enabled: true }
        },
        layout: {
            improvedLayout: true,
            hierarchical: {
                enabled: false
            }
        }
    };
    
    network = new vis.Network(container, data, options);
    
    network.on('stabilizationIterationsDone', function() {
        network.setOptions({ physics: { enabled: false } });
    });
    
    // Создаем тултип
    const tooltipContainer = document.createElement('div');
    tooltipContainer.id = 'tooltip-container';
    tooltipContainer.style.cssText = `
        position: absolute;
        display: none;
        background: #2D2F3D;
        color: #FFFFFF;
        padding: 10px;
        border-radius: 5px;
        border: 1px solid #0d6efd;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        max-width: 400px;
        z-index: 1001;
        font-family: monospace;
    `;
    container.appendChild(tooltipContainer);
    
    // Обработчики для тултипа
    network.on('hoverNode', function(params) {
        const nodeId = params.node;
        const func = functions.get(nodeId);
        if (func) {
            tooltipContainer.innerHTML = createTooltipContent(func);
            const position = network.getPositions([nodeId])[nodeId];
            const canvasPosition = network.canvasToDOM(position);
            
            const rect = container.getBoundingClientRect();
            let left = canvasPosition.x + 20;
            let top = canvasPosition.y - 20;
            
            const tooltipRect = tooltipContainer.getBoundingClientRect();
            if (left + tooltipRect.width > rect.right) {
                left = canvasPosition.x - tooltipRect.width - 20;
            }
            if (top + tooltipRect.height > rect.bottom) {
                top = canvasPosition.y - tooltipRect.height - 20;
            }
            
            tooltipContainer.style.left = `${left}px`;
            tooltipContainer.style.top = `${top}px`;
            tooltipContainer.style.display = 'block';
            
            tooltipContainer.querySelectorAll('.log-message').forEach(el => {
                el.onclick = function(e) {
                    e.stopPropagation();
                    showMetadataModal(JSON.parse(this.dataset.metadata));
                };
            });
        }
    });
    
    network.on('blurNode', function() {
        tooltipContainer.style.display = 'none';
    });
}

function createTooltipContent(func) {
    if (!func.messages || func.messages.length === 0) return '';
    
    return `
        <div style="margin-bottom: 10px;">
            <div><b>Функция:</b> ${func.label}</div>
        </div>
        <div>
            <div><b>Сообщения (${func.messages.length}):</b></div>
            <ul style="list-style: none; padding-left: 0; margin: 5px 0;">
                ${func.messages.map(msg => `
                    <li style="margin-bottom: 5px;">
                        <span style="
                            display: inline-block;
                            padding: 2px 6px;
                            border-radius: 3px;
                            font-size: 12px;
                            font-weight: bold;
                            color: white;
                            background-color: ${getLevelColor(msg.level)};
                        ">${msg.level}</span>
                        <span class="log-message" 
                              style="margin-left: 5px; cursor: pointer; color: #81C784;" 
                              data-metadata='${JSON.stringify(msg.metadata)}'>
                            ${msg.message}
                        </span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function showMetadataModal(metadata) {
    const modalContainer = document.createElement('div');
    modalContainer.id = 'metadata-modal-container';
    modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const formattedMetadata = JSON.stringify(metadata, null, 2);
    
    modalContainer.innerHTML = `
        <div style="
            background: #2D2F3D;
            color: #FFFFFF;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #0d6efd;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            font-family: monospace;
            position: relative;
        ">
            <h3 style="margin-top: 0; color: #81C784;">Метаданные</h3>
            <pre style="background: #1E1E1E; padding: 10px; border-radius: 4px; overflow-x: auto; color: #FFFFFF;">${formattedMetadata}</pre>
            <button style="
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 5px 15px;
                background: #0d6efd;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-family: monospace;
            ">✕</button>
        </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Закрытие модального окна
    modalContainer.querySelector('button').onclick = () => {
        document.body.removeChild(modalContainer);
    };
    
    modalContainer.onclick = (e) => {
        if (e.target === modalContainer) {
            document.body.removeChild(modalContainer);
        }
    };
}

function getLevelColor(level) {
    const colors = {
        'DEBUG': '#6c757d',
        'INFO': '#198754',
        'WARNING': '#ffc107',
        'ERROR': '#dc3545',
        'CRITICAL': '#6f42c1'
    };
    return colors[level] || '#6c757d';
}
