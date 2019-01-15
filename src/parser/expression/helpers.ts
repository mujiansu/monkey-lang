import { Token, TokenKind } from '../../lexer/types';
import { AssertionError, Expression } from '../ast/types';
import { AssertionResult, OperatorPrecedences, Precedence } from '../types';

export function createAssertionResult(errors: AssertionError[] = []): AssertionResult {
  return {
    errors
  };
}

export function createExpression(tokens: Token[]): Expression {
  return { tokens };
}

export function determineOperatorPrecedence(operator: Token): Precedence {
  let precedence;

  if (operator) {
    precedence = OperatorPrecedences[operator.kind];
  }

  return precedence || Precedence.Lowest;
}

export function isNextTokenImmediateValue(token: Token): boolean {
  return token.kind === TokenKind.Int || token.kind === TokenKind.Identifier || token.kind === TokenKind.True || token.kind === TokenKind.False;
}

export function isPrefixToken(token: Token): boolean {
  return token.kind === TokenKind.Bang || token.kind === TokenKind.Minus;
}
