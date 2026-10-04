export interface ResearchAgentInput {
  topic: string;
  primaryKeyword: string;
  language?: string;
}

export interface ResearchAgentOutput {
  summary: string;
  outlines: string[];
  references: string[];
}

export interface WriterAgentInput {
  title: string;
  outline: string[];
  researchSummary: string;
}

export interface WriterAgentOutput {
  content: string;
  excerpt?: string;
  metaDescription?: string;
}

export interface QualityAgentInput {
  title: string;
  content: string;
  primaryKeyword: string;
}

export interface QualityAgentOutput {
  seoScore: number;
  feedback: string[];
}

export interface ResearchAgent {
  run(input: ResearchAgentInput): Promise<ResearchAgentOutput>;
}

export interface WriterAgent {
  run(input: WriterAgentInput): Promise<WriterAgentOutput>;
}

export interface QualityAgent {
  run(input: QualityAgentInput): Promise<QualityAgentOutput>;
}
