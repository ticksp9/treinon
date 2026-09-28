/**
 * Template Engine — Type contracts
 */

export type DeliveryChannel = 'email' | 'sms' | 'whatsapp';
export type ProfileType = 'guardian' | 'player' | 'coach' | 'assistant_coach' | 'staff';

export interface TemplateVariableDefinition {
  key: string;
  label: string;
  description: string;
  required: boolean;
  supportedChannels: DeliveryChannel[];
  supportedProfiles: ProfileType[];
  defaultFallback?: string;
  exampleValue: string;
}

export interface ParsedToken {
  raw: string;
  variableKey: string;
  startIndex: number;
  endIndex: number;
  isValid: boolean;
  isSafe: boolean;
  errorMessage?: string;
}

export interface ParseResult {
  tokens: ParsedToken[];
  variablesFound: string[];
  invalidTokens: ParsedToken[];
  unsafeTokens: ParsedToken[];
  normalizedTemplate: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  variablesFound: string[];
  unknownVariables: string[];
  missingRequiredVariables: string[];
  optionalWithoutValue: string[];
  invalidSyntaxTokens: string[];
}

export interface RenderResult {
  renderedText: string;
  variablesUsed: string[];
  variablesResolved: string[];
  variablesWithFallback: string[];
  missingRequired: string[];
  warnings: string[];
}

export interface PreviewContext {
  channel: DeliveryChannel;
  profileType: ProfileType;
  mockData: Record<string, string>;
}

export interface SmsEstimate {
  chars: number;
  segments: number;
}
