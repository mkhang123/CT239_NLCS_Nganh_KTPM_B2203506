const Vertex = require('./vertex.js');
const Edge = require('./edge.js');

class Graph {
    constructor() {
        this.vertices = [];
        this.edges = [];
    }

    addVertex(id, label, x, y) {
        if (this.vertices.find(v => v.id === id)) return false;
        this.vertices.push(new Vertex(id, label, x, y));
        return true;
    }

    removeVertex(id) {
        this.vertices = this.vertices.filter(v => v.id !== id);
        this.edges = this.edges.filter(e => e.u !== id && e.v !== id);
        return true;
    }

    addEdge(u, v, w) {
        if (u > v) [u, v] = [v, u];
        if (!this.getVertexById(u) || !this.getVertexById(v)) return false;
        if (this.hasEdge(u, v)) return false;
        this.edges.push(new Edge(u, v, w)); //Trọng số được lưu ở đây
        return true;
    }

    removeEdge(u, v) {
        const index = this.edges.findIndex(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
        if (index === -1) return false;
        this.edges.splice(index, 1);
        return true;
    }

    setEdgeWeight(u, v, w) {
        const edge = this.edges.find(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
        if (!edge) return false;
        edge.setWeight(w);
        return true;
    }

    hasEdge(u, v) {
        return this.edges.some(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
    }

    getNeighbors(v) {
        const neighbors = [];
        this.edges.forEach(edge => {
            if (edge.u === v) neighbors.push(edge.v);
            if (edge.v === v) neighbors.push(edge.u);
        });
        return neighbors;
    }

    getEdgeWeight(u, v) {
        const edge = this.edges.find(e => (e.u === u && e.v === v) || (e.u === v && e.v === u));
        return edge ? edge.w : null;
    }

    getVertexById(id) {
        return this.vertices.find(v => v.id === id) || null;
    }

    getVertexPosition(id) {
        const v = this.getVertexById(id);
        return v ? { x: v.x, y: v.y } : { x: 0, y: 0 };
    }

    setVertexPosition(id, x, y) {
        const v = this.getVertexById(id);
        if (v) v.setPosition(x, y);
    }

    getVertexLabel(id) {
        const v = this.getVertexById(id);
        return v ? v.label : null;
    }

    getVertices() {
        return this.vertices.map(v => v.id);
    }

    getEdges() {
        return this.edges;
    }

    toJSON() {
        return {
            vertices: this.vertices,
            edges: this.edges
        };
    }

    static fromJSON(json) {
        const g = new Graph();
        json.vertices.forEach(v => g.vertices.push(Vertex.fromJSON(v)));
        json.edges.forEach(e => g.edges.push(Edge.fromJSON(e)));
        return g;
    }

    createSubgraph(vertices) {
        const subgraph = new Graph();

        // Thêm đỉnh
        vertices.forEach(v => {
            const vertexData = this.vertices.find(vertex => vertex.id === v);
            if (vertexData) {
                subgraph.addVertex(vertexData.id, vertexData.label, vertexData.x, vertexData.y);
            }
        });

        // Thêm cạnh
        this.edges.forEach(edge => {
            if (vertices.includes(edge.u) && vertices.includes(edge.v)) {
                subgraph.addEdge(edge.u, edge.v, edge.w);
            }
        });

        return subgraph;
    }

}

module.exports = Graph;
