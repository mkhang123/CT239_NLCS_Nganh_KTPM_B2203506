function prim(graph, startId = 1) {
  const vertices = graph.getVertices(); // Lấy danh sách ID các đỉnh (có thể không liên tục)
  const idToIndex = new Map();          // Map ID → chỉ số
  const indexToId = [];                 // Array chỉ số → ID

  vertices.forEach((id, index) => {
    idToIndex.set(id, index);
    indexToId[index] = id;
  });

  const n = vertices.length;
  const visited = Array(n).fill(false);
  const key = Array(n).fill(Infinity);
  const parent = Array(n).fill(-1);

  const start = idToIndex.get(startId);
  key[start] = 0;

  for (let i = 0; i < n; i++) {
    let u = -1;
    let minKey = Infinity;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && key[v] < minKey) {
        minKey = key[v];
        u = v;
      }
    }

    if (u === -1) break;
    visited[u] = true;

    const uId = indexToId[u];
    const neighbors = graph.getNeighbors(uId);

    for (const vId of neighbors) {
      const v = idToIndex.get(vId);
      const w = graph.getEdgeWeight(uId, vId);
      if (!visited[v] && w < key[v]) {
        key[v] = w;
        parent[v] = u;
      }
    }
  }

  // Xây dựng kết quả
  const mstEdges = [];
  let total = 0;
  for (let v = 0; v < n; v++) {
    if (parent[v] !== -1) {
      const u = parent[v];
      const uId = indexToId[u];
      const vId = indexToId[v];
      const w = key[v];
      mstEdges.push({ u: Math.min(uId, vId), v: Math.max(uId, vId), w });
      total += w;
    }
  }

  return { mstEdges, total };
}

module.exports = prim;
