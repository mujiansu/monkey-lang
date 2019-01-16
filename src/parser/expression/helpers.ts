import { Token, TokenKind } from '../../lexer/types';
import { AssertionError, Expression, ExpressionValue } from '../ast/types';
import {
  AssertionResult,
  ExpressionParseResult,
  OperatorPrecedences,
  ParsingFunction,
  Precedence
} from '../types';

import { parseBlockStatement } from '../statement';

export function createAssertionResult(errors: AssertionError[] = []): AssertionResult {
  return {
    errors
  };
}

export function parseExpression(tokens: Token[], cursor: number, precedence: Precedence): ExpressionParseResult {
  let leftExpressionParseResult = parsePrefixExpression(tokens, cursor);
  let nextPrecedence = leftExpressionParseResult.nextPrecedence;

  cursor = leftExpressionParseResult.cursor;

  while (cursor < tokens.length && precedence < nextPrecedence) {
    leftExpressionParseResult = parseInfixExpression(tokens, leftExpressionParseResult.cursor, leftExpressionParseResult.expression);
    nextPrecedence = leftExpressionParseResult.nextPrecedence;
    cursor = leftExpressionParseResult.cursor;
  }

  return leftExpressionParseResult;
}

function createExpression(tokens: Token[]): Expression {
  return { tokens };
}

function determineOperatorPrecedence(operator: Token): Precedence {
  let precedence;

  if (operator) {
    precedence = OperatorPrecedences[operator.kind];
  }

  return precedence || Precedence.Lowest;
}

const ParsingFunctions: { [index: number]: ParsingFunction } = {
   2: parseValueExpression,
   3: parseValueExpression,
  18: parseValueExpression,
  19: parseValueExpression,
  20: parseIfExpression,
  23: parseGroupedExpression
};

function expandPrefixExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let operator = tokens[cursor];
  let left = createExpression([operator]);
  left.operator = operator;

  let prefixExpressionParseResult = parseExpression(tokens, cursor + 1, Precedence.Prefix);
  let expression = createExpression(left.tokens.concat(prefixExpressionParseResult.expression.tokens));
  expression.left = left;
  expression.right = prefixExpressionParseResult.expression;

  return {
    expression,
    cursor: prefixExpressionParseResult.cursor,
    nextPrecedence: prefixExpressionParseResult.nextPrecedence
  };
}

function parseGroupedExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let expressionParseResult = parseExpression(tokens, cursor + 1, Precedence.Lowest);
  let nextToken = tokens[expressionParseResult.cursor];
  let index = 0;

  while (nextToken && nextToken.kind === TokenKind.RightParenthesis) {
    index++;
    nextToken = tokens[expressionParseResult.cursor + index];
  }

  expressionParseResult.cursor = expressionParseResult.cursor + index;
  expressionParseResult.nextPrecedence = determineOperatorPrecedence(nextToken);

  return expressionParseResult;
}

function parseIfExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let skipIfTokenCursor = cursor + 1;
  let conditionParseResult = parseExpression(tokens, skipIfTokenCursor, Precedence.Lowest);

  let skipLeftBraceCursor = conditionParseResult.cursor + 1;
  let consequenceParseResult = parseBlockStatement(tokens, skipLeftBraceCursor);

  let ifExpressionParseResultCursor = consequenceParseResult.cursor;
  let includeRightBraceCursor = consequenceParseResult.cursor + 1;

  let alternativeParseResult;
  let elseToken = tokens[consequenceParseResult.cursor + 1];
  if (elseToken && elseToken.kind === TokenKind.Else) {
    let skipElseLeftBraceTokenCursor = consequenceParseResult.cursor + 3;
    alternativeParseResult = parseBlockStatement(tokens, skipElseLeftBraceTokenCursor);
    includeRightBraceCursor = alternativeParseResult.cursor + 1;
  }

  let expression = createExpression(tokens.slice(cursor, includeRightBraceCursor));
  expression.condition = conditionParseResult.expression;
  expression.consequence = {
    statements: consequenceParseResult.statements,
    tokens: consequenceParseResult.tokens
  };

  if (alternativeParseResult) {
    expression.alternative = {
      statements: alternativeParseResult.statements,
      tokens: alternativeParseResult.tokens
    };
  }

  return {
    expression,
    cursor: ifExpressionParseResultCursor,
    nextPrecedence: Precedence.Lowest
  };
}

function parseInfixExpression(tokens: Token[], cursor: number, left: Expression): ExpressionParseResult {
  let operator = tokens[cursor];
  let currentPrecedence = determineOperatorPrecedence(operator);

  let rightExpressionParseResult = parseExpression(tokens, cursor + 1, currentPrecedence);

  let expression = createExpression(left.tokens.concat([operator]).concat(rightExpressionParseResult.expression.tokens));
  expression.left = left;
  expression.operator = operator;
  expression.right = rightExpressionParseResult.expression;

  return {
    expression,
    cursor: rightExpressionParseResult.cursor,
    nextPrecedence: rightExpressionParseResult.nextPrecedence
  };
}

function parsePrefixExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let currentToken = tokens[cursor];

  switch (currentToken.kind) {
    case TokenKind.Int:
    case TokenKind.Identifier:
    case TokenKind.True:
    case TokenKind.False:
    case TokenKind.LeftParenthesis:
    case TokenKind.If:
      return ParsingFunctions[currentToken.kind](tokens, cursor);
    default:
      return expandPrefixExpression(tokens, cursor);
  }
}

function parseValueExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let currentToken = tokens[cursor];
  let nextToken = tokens[cursor + 1];
  let nextPrecedence = determineOperatorPrecedence(nextToken);
  let expression = createExpression([currentToken]);
  expression.value = parseExpressionValue(currentToken);

  return {
    expression,
    cursor: cursor + 1,
    nextPrecedence
  };
}

function parseExpressionValue(token: Token): ExpressionValue {
  switch (token.kind) {
    case TokenKind.Int:
      return parseInt(token.literal, 10);
    case TokenKind.True:
    case TokenKind.False:
      return token.kind === TokenKind.True ? true : false;
    default:
      return token.literal;
  }
}
