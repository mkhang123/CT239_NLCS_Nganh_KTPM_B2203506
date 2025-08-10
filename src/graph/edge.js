class Edge {
    constructor(u, v, w) {
        // Chuẩn hóa u < v
        if (u > v) [u, v] = [v, u];
        this.u = u;
        this.v = v;
        this.w = w || 0;
    }

    setWeight(w) {
        this.w = w;
    }

    hasVertex(vertexId) {
        return this.u === vertexId || this.v === vertexId;
    }

    getOtherVertex(vertexId) {
        if (this.u === vertexId) return this.v;
        if (this.v === vertexId) return this.u;
        return null;
    }

    toJSON() {
        return { u: this.u, v: this.v, w: this.w };
    }

    static fromJSON(json) {
        return new Edge(json.u, json.v, json.w); // constructor sẽ tự chuẩn hóa
    }
}

module.exports = Edge;
