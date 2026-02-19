// import crypto from "crypto";

// type Conn = { connectionString: string; schema: string };

// type Project = {
//   id: string;
//   createdAt: string;
//   connection?: Conn;

//   artifacts?: {
//     config: any;
//     samples: any;
//   };

//   ai?: any;

//   reports?: any;

//   proof?: { explanation?: string };

//   final?: any;
// };

// const store = new Map<string, Project>();

// export const projectStore = {
//   createProject(): Project {
//     const id = crypto.randomBytes(8).toString("hex");
//     const p: Project = { id, createdAt: new Date().toISOString() };
//     store.set(id, p);
//     return p;
//   },

//   getProject(id: string): Project {
//     const p = store.get(id);
//     if (!p) throw new Error("Project not found");
//     return p;
//   },

//   setConnection(id: string, conn: Conn) {
//     const p = this.getProject(id);
//     p.connection = conn;
//   },

//   setArtifacts(id: string, artifacts: any) {
//     const p = this.getProject(id);
//     p.artifacts = artifacts;
//   },

//   setAi(id: string, ai: any) {
//     const p = this.getProject(id);
//     p.ai = ai;
//   },

//   setReports(id: string, reports: any) {
//     const p = this.getProject(id);
//     p.reports = reports;
//   },

//   setProof(id: string, proof: any) {
//     const p = this.getProject(id);
//     p.proof = proof;
//   },

//   setFinal(id: string, final: any) {
//     const p = this.getProject(id);
//     p.final = final;
//   },
// };

import crypto from "crypto";

type Conn = { connectionString: string; schema: string };

type Project = {
  id: string;
  createdAt: string;

  connection?: Conn;

  artifacts?: {
    config: any;
    samples: any;
  };

  uploadedConfig?: any;

  ai?: any;

  reports?: any;
};

const store = new Map<string, Project>();

export const projectStore = {
  createProject(): Project {
    const id = crypto.randomBytes(8).toString("hex");
    const p: Project = { id, createdAt: new Date().toISOString() };
    store.set(id, p);
    return p;
  },

  getProject(id: string): Project {
    const p = store.get(id);
    if (!p) throw new Error("Project not found");
    return p;
  },

  setConnection(id: string, conn: Conn) {
    const p = this.getProject(id);
    p.connection = conn;
  },

  setArtifacts(id: string, artifacts: any) {
    const p = this.getProject(id);
    p.artifacts = artifacts;
  },

  setUploadedConfig(id: string, cfg: any) {
    const p = this.getProject(id);
    p.uploadedConfig = cfg;
  },

  setAi(id: string, ai: any) {
    const p = this.getProject(id);
    p.ai = ai;
  },

  setReports(id: string, reports: any) {
    const p = this.getProject(id);
    p.reports = reports;
  },
};

