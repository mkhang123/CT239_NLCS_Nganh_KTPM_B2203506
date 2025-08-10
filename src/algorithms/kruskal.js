function kruskal(graph) {
    const edges = [...graph.edges].sort((a, b) => {
        if (a.w !== b.w) return a.w - b.w;
        if (a.u !== b.u) return a.u - b.u;
        return a.v - b.v;
    });

    // Giả sử ID đỉnh từ 1 đến n (giống C)
    const maxId = Math.max(...graph.getVertices());
    const parent = Array.from({ length: maxId + 1 }, (_, i) => i);
    
    const findRoot = (u) => {
        if (parent[u] !== u) {
            parent[u] = findRoot(parent[u]);
        }
        return parent[u];
    };

    const mstEdges = [];
    let total = 0;

    for (const edge of edges) {
        const rootU = findRoot(edge.u);
        const rootV = findRoot(edge.v);
        
        if (rootU !== rootV) {
            mstEdges.push(edge);
            parent[rootV] = rootU;
            total += edge.w;
        }
    }

    return { mstEdges, total };
}

module.exports = kruskal;
