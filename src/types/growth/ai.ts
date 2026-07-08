
export type JobStatus = 'queued' | 'running' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  uid: string;
  brandId: string;
  type: 'post_generation' | 'campaign' | 'variant';

  status: JobStatus;
  progress: number;
  currentStep: string;

  resultPostId?: string;
  error?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface OpenAIRawResult {
  text: string;
  tokensUsed: { input: number; output: number };
  cost: number;
  generationMs: number;
  model: string;
}

export interface FalImageResult {
  imageUrl: string;
  cost: number;
  generationMs: number;
  model: string;
  provider: 'fal_flux';
}

export interface IdeogramImageResult {
  imageUrl: string;
  cost: number;
  generationMs: number;
  model: string;
  provider: 'ideogram';
}

export type AIImageGenerationResult = FalImageResult | IdeogramImageResult;

export type AITextGenerationResult = OpenAIRawResult;
