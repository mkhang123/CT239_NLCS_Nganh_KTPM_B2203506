const d3 = require('d3');
const Graph = require('./graph/graph.js');
const GraphVisualizer = require('./visualization/graphVisualizer.js');
const { saveGraphToFile, loadGraphFromFile } = require('./utils/fileUtils.js');
const kruskal = require('./algorithms/kruskal.js');
const prim = require('./algorithms/prim.js');
const dfs = require('./algorithms/dfs.js');

let selectedNodeId = null;
let selectedEdge = null;

/* === Khởi tạo biến toàn cục === */
// Lấy container canvas và kích thước
const canvasContainer = document.querySelector('.canvas-container');
const canvasWidth = canvasContainer.clientWidth;
const canvasHeight = canvasContainer.clientHeight;

// Khởi tạo đối tượng đồ thị và trình trực quan hóa
const graph = new Graph();
const visualizer = new GraphVisualizer('#graph-canvas', canvasWidth, canvasHeight);

// Lấy các phần tử giao diện
const algorithmSelect = document.getElementById('algorithm-select');
const startNodeSelect = document.getElementById('start-node-select');
const runAlgorithmButton = document.getElementById('run-algorithm');
const checkComponentButton = document.getElementById('check-component');
const randomGraphButton = document.getElementById('random-graph');
const clearGraphButton = document.getElementById('clear-graph');
const optionsSelect = document.getElementById('options-select');
const messageContent = document.getElementById('contentMessage');

// Biến lưu trữ trạng thái
let currentGraphId = null; // ID đồ thị hiện tại
let selectedNodesForEdge = []; // Lưu các đỉnh được chọn để tạo cạnh
let lastAlgorithmResult = null; // Lưu kết quả thuật toán gần nhất

/* === Hàm tiện ích === */
/**
 * Hiển thị thông báo trên giao diện
 * @param {string} message - Thông báo cần hiển thị
 */
function showMessage(message) {
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageContent.innerHTML = formattedMessage;
}

/**
 * Cập nhật danh sách các đỉnh trong dropdown chọn đỉnh đầu
 */
function updateNodeDropdowns(algorithm = 'default') {
    startNodeSelect.innerHTML = '<option value="default" selected hidden>Chọn đỉnh đầu</option>';
    const vertices = graph.getVertices();
    vertices.forEach(id => {
        const label = graph.getVertexLabel(id);
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        startNodeSelect.appendChild(option);
    });

    // Ẩn hoặc hiển thị tùy thuật toán
    switch (algorithm) {
        case 'kruskal':
            startNodeSelect.style.display = 'none';
            break;
        case 'prim':
            startNodeSelect.style.display = 'inline';
            break;
        default:
            startNodeSelect.style.display = 'inline';
            break;
    }
}

/**
 * Tạo ID cho đỉnh dựa trên chỉ số
 * @param {number} index - Chỉ số của đỉnh
 * @returns {string} - ID dạng chữ cái (A, B, ..., AA, AB, ...)
 */
function generateVertexId(index) {
    if (index < 26) {
        return String.fromCharCode(65 + index);
    } else {
        const firstCharIndex = Math.floor((index - 26) / 26);
        const secondCharIndex = (index - 26) % 26;
        return String.fromCharCode(65 + firstCharIndex) + String.fromCharCode(65 + secondCharIndex);
    }
}

/**
 * Tự động bố trí sắp xếp theo lưới
 */
function autoLayoutGraph() {
    const vertices = graph.getVertices();
    const n = vertices.length;
    if (n === 0) return;

    const gridSize = Math.ceil(Math.sqrt(n));
    const cellWidth = canvasWidth / (gridSize + 1);
    const cellHeight = canvasHeight / (gridSize + 1);

    vertices.forEach((id, i) => {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;
        const x = (col + 1) * cellWidth;
        const y = (row + 1) * cellHeight;
        graph.setVertexPosition(id, x, y);
    });

    visualizer.updateGraph(graph);
    showMessage('Đã tự động sắp xếp đồ thị.');
}

/* === Hàm quản lý đồ thị === */
/**
 * Lưu đồ thị vào localStorage
 * @param {string} name - Tên đồ thị
 * @param {Graph} graph - Đối tượng đồ thị
 * @returns {string} - ID của đồ thị
 */
function saveGraphToStorage(name, graph) {
    const graphs = JSON.parse(localStorage.getItem('graphs') || '{}');
    const graphId = Date.now().toString();
    graphs[graphId] = { name, data: graph.toJSON() };
    localStorage.setItem('graphs', JSON.stringify(graphs));
    return graphId;
}

/**
 * Tải danh sách đồ thị từ localStorage
 */
function loadGraphList() {
    const graphList = document.getElementById('graph-list');
    graphList.innerHTML = '<option value="default" selected hidden>Chọn đồ thị</option>';
    const graphs = JSON.parse(localStorage.getItem('graphs') || '{}');
    Object.entries(graphs).forEach(([id, { name }]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        graphList.appendChild(option);
    });
}

/**
 * Tải đồ thị từ localStorage
 * @param {string} graphId - ID của đồ thị
 */
function loadGraphFromStorage(graphId) {
    const graphs = JSON.parse(localStorage.getItem('graphs') || '{}');
    const graphData = graphs[graphId]?.data;
    if (graphData) {
        const loadedGraph = Graph.fromJSON(graphData);
        graph.vertices = loadedGraph.vertices;
        graph.edges = loadedGraph.edges;
        visualizer.updateGraph(graph);
        attachNodeAndEdgeEvents();
        currentGraphId = graphId;
        showMessage(`Đã tải đồ thị: ${graphs[graphId].name} từ localStorage.`);
    } else {
        showMessage('Không tìm thấy đồ thị.');
    }
}

/**
 * Hàm để xóa đồ thị khỏi localStorage
 * @param {string} graphId - ID của đồ thị
 */
function deleteGraphFromStorage(graphId) {
    const graphs = JSON.parse(localStorage.getItem('graphs') || '{}');
    if (graphs[graphId]) {
        delete graphs[graphId];
        localStorage.setItem('graphs', JSON.stringify(graphs));
        loadGraphList();
        if (currentGraphId === graphId) {
            graph.vertices = [];
            graph.edges = [];
            visualizer.updateGraph(graph);
            currentGraphId = null;
            showMessage('Đồ thị đã được xóa.');
        }
    }
}

/* === Hàm hiển thị modal === */
/**
 * Hiển thị modal để nhập tên đồ thị
 * @returns {Promise<string|null>} - Tên đồ thị hoặc null nếu hủy
 */
function showSaveGraphModal() {
    return new Promise((resolve) => {
        const saveGraphModal = document.getElementById('saveGraphModal');
        const graphNameInput = document.getElementById('graphNameInput');
        const saveGraphOk = document.getElementById('saveGraphOk');
        const saveGraphCancel = document.getElementById('saveGraphCancel');

        saveGraphModal.style.display = 'block';
        graphNameInput.value = '';
        saveGraphOk.onclick = () => {
            const name = graphNameInput.value.trim();
            saveGraphModal.style.display = 'none';
            resolve(name);
        };
        saveGraphCancel.onclick = () => {
            saveGraphModal.style.display = 'none';
            resolve(null);
        };
    });
}

/* === Hàm xử lý sự kiện === */
/**
 * Gắn sự kiện cho các đỉnh, cạnh và canvas
 */
function attachNodeAndEdgeEvents() {
    // Lấy các phần tử modal
    const weightModal = document.getElementById('weightModal');
    const weightInput = document.getElementById('weightInput');
    const weightOk = document.getElementById('weightOk');
    const weightNoWeight = document.getElementById('weightNoWeight');
    const weightCancel = document.getElementById('weightCancel');
    const labelModal = document.getElementById('labelModal');
    const labelInput = document.getElementById('labelInput');
    const labelOk = document.getElementById('labelOk');
    const labelCancel = document.getElementById('labelCancel');

    /**
     * Hiển thị modal để nhập trọng số
     * @param {number} currentWeight - Trọng số hiện tại
     * @returns {Promise<number|null>} - Trọng số mới hoặc null nếu hủy
     */
    const showWeightModal = (currentWeight = 1) => {
        return new Promise((resolve) => {
            weightModal.style.display = 'block';
            weightInput.value = currentWeight;
            weightOk.onclick = () => {
                const weight = parseFloat(weightInput.value);
                weightModal.style.display = 'none';
                resolve(weight);
            };
            weightNoWeight.onclick = () => {
                weightModal.style.display = 'none';
                resolve(0);
            };
            weightCancel.onclick = () => {
                weightModal.style.display = 'none';
                resolve(null);
            };
        });
    };

    /**
     * Hiển thị modal để chỉnh sửa nhãn
     * @param {string} currentLabel - Nhãn hiện tại
     * @returns {Promise<string|null>} - Nhãn mới hoặc null nếu hủy
     */
    const showLabelModal = (currentLabel) => {
        return new Promise((resolve) => {
            labelModal.style.display = 'block';
            labelInput.value = currentLabel;
            labelOk.onclick = () => {
                const newLabel = labelInput.value.trim();
                labelModal.style.display = 'none';
                resolve(newLabel);
            };
            labelCancel.onclick = () => {
                labelModal.style.display = 'none';
                resolve(null);
            };
        });
    };

    //Các hàm sự kiện như tạo đỉnh (thêm đỉnh), tạo khung...
    const svg = d3.select('#graph-canvas');
    svg.on('dblclick', function (event) {
        let [x, y] = d3.pointer(event).map(Math.round);
        const minDistance = 80; // ngưỡng tối thiểu để không thêm trùng

        // Kiểm tra khoảng cách với tất cả đỉnh
        const tooClose = graph.getVertices().some(id => {
            const pos = graph.getVertexPosition(id);
            const dx = pos.x - x;
            const dy = pos.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < minDistance;
        });

        if (tooClose) {
            showMessage('Khoảng cách quá gần đỉnh khác. Không thể thêm đỉnh tại vị trí này.');
            return;
        }
        //Tạo đỉnh
        const id = graph.getVertices().length + 1;
        const label = generateVertexId(id - 1);
        const added = graph.addVertex(id, label, x, y);

        if (added) {
            visualizer.updateGraph(graph);
            attachNodeAndEdgeEvents();
            showMessage(`Đỉnh ${label} đã được thêm tại (${x}, ${y})`);
        } else {
            showMessage(`Không thể thêm đỉnh: ID ${id} đã tồn tại.`);
        }
    });

    //Hàm gắn sự kiện đỉnh và cạnh
    function attachNodeAndEdgeEvents() {
        visualizer.nodes.selectAll('.node')
            .on('click', async function (event, d) {
                event.stopPropagation();

                //Tô sáng node được chọn
                selectedNodeId = d.id;
                selectedEdge = null;
                d3.selectAll('.node').classed('selected', false);
                d3.select(this).classed('selected', true);

                //Nếu có nhấn Shift thì tiến hành thêm cạnh
                if (event.shiftKey) {
                    selectedNodesForEdge.push(d.id);
                    const label = graph.getVertexLabel(d.id);
                    showMessage(`Đã chọn đỉnh ${label}. ${selectedNodesForEdge.length === 1 ? 'Chọn đỉnh thứ hai để tạo cạnh.' : ''}`);

                    if (selectedNodesForEdge.length === 2) {
                        const [u, v] = selectedNodesForEdge;

                        if (u === v) {
                            showMessage('Không thể tạo cạnh giữa một đỉnh với chính nó.');
                        } else if (graph.hasEdge(u, v)) {
                            showMessage('Cạnh đã tồn tại giữa hai đỉnh này.');
                        } else {
                            const weight = await showWeightModal();
                            if (weight === null) {
                                showMessage('Hủy thêm cạnh.');
                            } else if (isNaN(weight)) {
                                showMessage('Trọng số không hợp lệ, không tạo cạnh.');
                            } else {
                                graph.addEdge(u, v, weight);
                                const labelU = graph.getVertexLabel(u);
                                const labelV = graph.getVertexLabel(v);
                                visualizer.updateGraph(graph);
                                attachNodeAndEdgeEvents();
                                showMessage(`Đã thêm cạnh giữa ${labelU} và ${labelV} với trọng số ${weight}.`);
                            }
                        }
                        selectedNodesForEdge = [];
                    }
                }
            })
            //Chỉnh sửa nhãn đỉnh
            .on('dblclick', async function (event, d) {
                event.stopPropagation();
                const currentLabel = graph.getVertexLabel(d.id);
                const newLabel = await showLabelModal(currentLabel);
                if (newLabel === null) {
                    showMessage('Hủy chỉnh sửa nhãn đỉnh.');
                } else if (newLabel === '') {
                    showMessage('Nhãn không được để trống.');
                } else {
                    const vertex = graph.getVertexById(d.id);
                    vertex.setLabel(newLabel);
                    visualizer.updateGraph(graph);
                    attachNodeAndEdgeEvents();
                    showMessage(`Nhãn của đỉnh ${currentLabel} đã được đổi thành ${newLabel}.`);
                }
            });

        //Gán sự kiện click cho cạnh
        visualizer.edges.selectAll('.edge')
            .on('click', function (event, d) {
                event.stopPropagation();
                selectedEdge = d;
                selectedNodeId = null;
                d3.selectAll('.edge').classed('selected', false);
                d3.select(this).classed('selected', true);
            });
    }

    //Sự kiện nhấn nút Delete trên bàn phím để xóa đỉnh
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Delete') {
            if (selectedNodeId !== null) {
                const label = graph.getVertexLabel(selectedNodeId);
                graph.removeVertex(selectedNodeId);
                selectedNodeId = null;
                visualizer.updateGraph(graph);
                attachNodeAndEdgeEvents();
                showMessage(`Đã xóa đỉnh ${label}.`);
            } else if (selectedEdge !== null) { //Xóa cạnh
                const u = selectedEdge.source;
                const v = selectedEdge.target;
                const labelU = graph.getVertexLabel(u);
                const labelV = graph.getVertexLabel(v);
                graph.removeEdge(u, v);
                selectedEdge = null;
                visualizer.updateGraph(graph);
                attachNodeAndEdgeEvents();
                showMessage(`Đã xóa cạnh giữa ${labelU} và ${labelV}.`);
            }
        }
    });

    //Sự kiện chỉnh sửa trọng số cạnh
    document.addEventListener('contextmenu', async (event) => {
        // Ngăn menu mặc định hiện ra
        event.preventDefault();

        if (selectedEdge !== null) {
            const u = selectedEdge.source;
            const v = selectedEdge.target;
            const currentWeight = graph.getEdgeWeight(u, v);
            const newWeight = await showWeightModal(currentWeight);

            if (newWeight === null) {
                showMessage('Hủy chỉnh sửa trọng số cạnh.');
            } else if (isNaN(newWeight)) {
                showMessage('Trọng số không hợp lệ, không cập nhật.');
            } else {
                graph.setEdgeWeight(u, v, newWeight);
                visualizer.updateGraph(graph);
                attachNodeAndEdgeEvents();
                showMessage(`Cạnh từ ${graph.getVertexLabel(u)} đến ${graph.getVertexLabel(v)} đã được cập nhật trọng số thành ${newWeight === 0 ? 'không trọng số' : newWeight}.`);
            }
        }
    });

    //Sự kiện di chuyển trên canvas
    const moveCanvas = visualizer.svg;
    moveCanvas.call(d3.drag()
        .on('start', function (event) {
            // Không cho kéo nếu click trúng đỉnh
            const isOnNode = event.sourceEvent.target.closest('.node');
            if (isOnNode) return;
            d3.select(this).style('cursor', 'grabbing');
        })
        .on('drag', function (event) {
            const isOnNode = event.sourceEvent.target.closest('.node');
            if (isOnNode) return;

            const dx = event.dx;
            const dy = event.dy;

            graph.getVertices().forEach(id => {
                const pos = graph.getVertexPosition(id);
                const newX = Math.max(20, Math.min(visualizer.width - 20, pos.x + dx));
                const newY = Math.max(20, Math.min(visualizer.height - 20, pos.y + dy));
                graph.setVertexPosition(id, newX, newY);
            });
            visualizer.updateGraph(graph);
            attachNodeAndEdgeEvents();
        })
        .on('end', function (event) {
            const isOnNode = event.sourceEvent.target.closest('.node');
            if (isOnNode) return;

            d3.select(this).style('cursor', 'default');
        })
    );
}

/* === Sự kiện giao diện === */
// Chọn thuật toán
algorithmSelect.addEventListener('change', (event) => {
    const algorithm = event.target.value;
    switch (algorithm) {
        case 'kruskal':
            showMessage('Thuật toán Kruskal: Tìm cây khung nhỏ nhất bằng cách duyệt theo cạnh có trọng số tăng dần.');
            break;
        case 'prim':
            showMessage('Thuật toán Prim: Tìm cây khung nhỏ nhất bắt đầu từ một đỉnh.');
            break;
        default:
            break;
    }

    updateNodeDropdowns(algorithm);

    // Đoạn này để ẩn/hiện ô chọn đỉnh (đối với Prim mới hiện)
    const startNodeSelect = document.getElementById('start-node-select');
    const startNodeLabel = document.getElementById('start-node-label');

    if (startNodeSelect && startNodeLabel) {
        if (algorithm === 'kruskal') {
            startNodeSelect.style.display = 'none';
            startNodeLabel.style.display = 'none';
        } else {
            startNodeSelect.style.display = 'inline-block';
            startNodeLabel.style.display = 'inline-block';
        }
    }
});

// Chạy thuật toán
runAlgorithmButton.addEventListener('click', () => {
    const algorithm = algorithmSelect.value;
    const startNode = parseInt(startNodeSelect.value);

    if (algorithm === 'default') {
        showMessage('Vui lòng chọn thuật toán.');
        return;
    }
    if (algorithm === 'kruskal') {
    } 
    else if (algorithm === 'prim') {
        if (isNaN(startNode)) {
            showMessage('Vui lòng chọn đỉnh bắt đầu cho Prim.');
            return;
        }
    }

    let result = null;
    try {
        switch (algorithm) {
            case 'kruskal': {
                const result = kruskal(graph);
                const { count, components } = dfs(graph);
                if (count !== 1) {
                    // Đồ thị không liên thông - chạy Kruskal trên từng miền
                    let allMstEdges = [];
                    let messages = [];

                    components.forEach((comp, idx) => {
                        // Tạo subgraph từ miền liên thông
                        const subgraph = graph.createSubgraph(comp);
                        const result = kruskal(subgraph);
                        allMstEdges.push(...result.mstEdges);
                        const vertexLabels = comp.map(v => graph.getVertexLabel(v)).join(' - ');
                        messages.push(`Miền ${idx + 1} (${vertexLabels}): Tổng trọng số MST = ${result.total}`);

                    });

                    // Tô sáng tất cả cạnh MST của từng miền
                    visualizer.highlightEdges(allMstEdges);

                    // In ra thông báo
                    showMessage(`Đồ thị không liên thông — đã tìm MST cho từng miền:\n` + messages.join('\n'));
                    return;
                }
                const mstEdges = result.mstEdges;
                visualizer.highlightEdges(mstEdges);
                lastAlgorithmResult = { algorithm, mstEdges };
                showMessage(`Đã tìm được cây khung nhỏ nhất bằng Kruskal. Tổng trọng số = ${result.total}`);
                return;
            }
            case 'prim': {
                const mstPrim = prim(graph, startNode);
                lastAlgorithmResult = { algorithm, mstEdges: mstPrim.mstEdges }; //Tên thuật toán đang chạy (trong js cho phép viết tắt nếu cùng tên) và danh sách các cây khung nhỏ nhất
                visualizer.highlightEdges(mstPrim.mstEdges);
                showMessage(`Đã tìm được cây khung nhỏ nhất bằng Prim. Tổng trọng số: ${mstPrim.total}`);
                return;
            }
            default:
                showMessage('Vui lòng chọn một thuật toán hợp lệ.');
                return;
        }
    } catch (error) {
        console.error('Không chạy được thuật toán:', error);
        showMessage(`Lỗi: ${error.message}`);
        visualizer.clearHighlights();
    }
});

// Kiểm tra miền liên thông
checkComponentButton.addEventListener('click', () => {
    const { count, components } = dfs(graph);   
    const message = `Số miền liên thông: ${count}\n` +
        components.map((comp, idx) =>
            `Miền liên thông ${idx + 1}: ${comp.map(vertex => graph.getVertexLabel(vertex)).join(', ')}`
        ).join('\n');

    showMessage(message);
    visualizer.highlightComponents(components);
});

// Tạo đồ thị ngẫu nhiên
randomGraphButton.addEventListener('click', () => {
    graph.vertices = [];
    graph.edges = [];
    const numVertices = Math.floor(Math.random() * 3) + 4;
    const vertexIds = [];
    for (let i = 0; i < numVertices; i++) {
        const id = i + 1;
        vertexIds.push(id);
        const label = generateVertexId(i);
        const x = Math.floor(Math.random() * (canvasWidth - 100)) + 50;
        const y = Math.floor(Math.random() * (canvasHeight - 100)) + 50;
        graph.addVertex(id, label, x, y);
    }
    const maxEdges = (numVertices * (numVertices - 1)) / 2;
    const numEdges = Math.floor(Math.random() * (maxEdges - 1)) + 1;
    const addedEdges = new Set();
    for (let i = 0; i < numEdges; i++) {
        let u, v;
        let edgeKey;
        do {
            u = vertexIds[Math.floor(Math.random() * numVertices)];
            v = vertexIds[Math.floor(Math.random() * numVertices)];
            edgeKey = u < v ? `${u}-${v}` : `${v}-${u}`;
        } while (u === v || addedEdges.has(edgeKey));
        addedEdges.add(edgeKey);
        const weight = Math.floor(Math.random() * 10) + 1;
        graph.addEdge(u, v, weight);
    }
    visualizer.updateGraph(graph);
    const currentAlgorithm = algorithmSelect.value;
    updateNodeDropdowns(currentAlgorithm);         

    if (vertexIds.length > 0) {
        startNodeSelect.value = vertexIds[0].toString();
    }
    attachNodeAndEdgeEvents();
    showMessage(`Đồ thị ngẫu nhiên đã được tạo: ${numVertices} đỉnh, ${numEdges} cạnh.`);
});

// Xóa đồ thị đang trên canvas
clearGraphButton.addEventListener('click', () => {
    if (graph.vertices.length === 0 && graph.edges.length === 0) {
        return;
    }
    graph.vertices = [];
    graph.edges = [];
    visualizer.updateGraph(graph);
    const currentAlgorithm = algorithmSelect.value;
    updateNodeDropdowns(currentAlgorithm);         
    attachNodeAndEdgeEvents();
    showMessage('Đồ thị đã được xóa.');
    visualizer.clearHighlights();
    lastAlgorithmResult = null;
});

// Xử lý các tiện ích
optionsSelect.addEventListener('change', async (event) => {
    const option = event.target.value;  

    switch (option) {
        case 'export':
            const saveSuccess = await saveGraphToFile(graph);
            showMessage(saveSuccess ? 'Đồ thị đã được xuất thành file JSON.' : 'Xuất file thất bại.');
            break;
        case 'import':
            const loadedGraphData = await loadGraphFromFile();
            if (loadedGraphData) {
                const loadedGraph = Graph.fromJSON(loadedGraphData);
                graph.vertices = loadedGraph.vertices;
                graph.edges = loadedGraph.edges;
                visualizer.updateGraph(graph);
                attachNodeAndEdgeEvents();
                showMessage('Đồ thị đã được nhập từ file JSON.');
            } else {
                showMessage('Nhập file thất bại hoặc bị hủy.');
            }
            break;
        case 'image':
            const svg = document.querySelector('#graph-canvas');
            const svgData = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            const link = document.createElement('a');
            link.download = 'graph.svg';
            link.href = svgUrl;
            link.click();
            showMessage('Đồ thị đã được xuất thành tệp SVG.');
            setTimeout(() => URL.revokeObjectURL(svgUrl), 100);
            break;
        case 'dataStructure':
            const graphData = graph.toJSON();
            if (!graphData || !Array.isArray(graphData.vertices) || !Array.isArray(graphData.edges)) {
                showMessage('Lỗi: Dữ liệu đồ thị không hợp lệ.');
                break;
            }
            const V = graphData.vertices.length;
            const E = graphData.edges.length;
            const message = `Đồ thị có ${V} đỉnh và ${E} cạnh như sau:\n` +
                `Đỉnh:\n${graphData.vertices.map(v => v.label).join(', ')}\n` +
                `Cạnh:\n${graphData.edges.map(e => `(${graph.getVertexLabel(e.u)} - ${graph.getVertexLabel(e.v)}, ${e.w})`).join('\n')}`;
            showMessage(message);
            break;
        case 'auto-layout': //Sắp xếp lại đồ thị
            autoLayoutGraph();
            break;
    }
    event.target.value = "default";
});

//Lưu đồ thị vào localStorage
document.getElementById('save-graph').addEventListener('click', async () => {
    if (graph.getVertices().length === 0 && graph.getEdges().length === 0) {
            showMessage('Không có đồ thị nào trên canvas để lưu.');
            return;
    }
    const name = await showSaveGraphModal();
    if (name) {
        const graphId = saveGraphToStorage(name, graph);
        currentGraphId = graphId;
        loadGraphList();
        showMessage(`Đồ thị "${name}" đã được lưu.`);
    } else {
        showMessage('Hủy lưu đồ thị.');
    }
});

//Xóa đồ thị khỏi localStorage
    document.getElementById('delete-graph').addEventListener('click', () => {
        const graphList = document.getElementById('graph-list');
        const graphId = graphList.value;
        if (graphId === 'default') {
            showMessage('Vui lòng chọn một đồ thị từ danh sách để xóa.');
            return;
        }
        const graphs = JSON.parse(localStorage.getItem('graphs') || '{}');
        const graphName = graphs[graphId]?.name || 'Không xác định';
        deleteGraphFromStorage(graphId);
        graphList.value = 'default';
        showMessage(`Đồ thị "${graphName}" đã được xóa.`);
    });
    document.getElementById('graph-list').addEventListener('change', (event) => {
        const graphId = event.target.value;
        if (graphId !== 'default') {
            loadGraphFromStorage(graphId);
        }
    });

/* === Khởi tạo ứng dụng === */
/**
 * Khởi tạo đồ thị mẫu và giao diện
 */
function init() {
    // Cập nhật giao diện
    visualizer.updateGraph(graph);
    updateNodeDropdowns();
    attachNodeAndEdgeEvents();
    loadGraphList();

    window.electronAPI; // sử dụng như được expose
}

// Chạy hàm khởi tạo
init();