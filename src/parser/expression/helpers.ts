import { Token, TokenKind } from '../../lexer/types';
import { AssertionError, Expression, ExpressionValue } from '../ast/types';
import {
  AssertionResult,
  ExpressionParseResult,
  FunctionParametersParseResult,
  OperatorPrecedences,
  ParsingFunction,
  Precedence
} from '../types';

import { Include, Skip } from '../constants';
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

const ParsingFunctions: { [index: number]: ParsingFunction } = {
   2: parseValueExpression,
   3: parseValueExpression,
  16: parseFunctionExpression,
  18: parseValueExpression,
  19: parseValueExpression,
  20: parseIfExpression,
  23: parseGroupedExpression
};

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

function expandPrefixExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let operator = tokens[cursor];
  let left = createExpression([operator]);
  left.operator = operator;

  let prefixExpressionParseResult = parseExpression(tokens, cursor + Skip.Operator, Precedence.Prefix);
  let expression = createExpression(left.tokens.concat(prefixExpressionParseResult.expression.tokens));
  expression.left = left;
  expression.right = prefixExpressionParseResult.expression;

  return {
    expression,
    cursor: prefixExpressionParseResult.cursor,
    nextPrecedence: prefixExpressionParseResult.nextPrecedence
  };
}

function parseFunctionExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let parametersParseResult = parseFunctionParameters(tokens, cursor + Skip.Function + Skip.Parenthesis);
  let bodyParseResult = parseBlockStatement(tokens, parametersParseResult.cursor + Skip.Parenthesis + Skip.Brace);
  let functionExpressionTokens = tokens.slice(cursor, bodyParseResult.cursor + Include.Brace);
  let expression = createExpression(functionExpressionTokens);

  expression.value = {
    body: {
      statements: bodyParseResult.statements,
      tokens: bodyParseResult.tokens
    },
    parameters: parametersParseResult.parameters,
    tokens: functionExpressionTokens
  };

  return {
    expression,
    cursor: bodyParseResult.cursor,
    nextPrecedence: Precedence.Lowest
  };
}

function parseFunctionParameters(tokens: Token[], cursor: number): FunctionParametersParseResult {
  let currentToken = tokens[cursor];
  let index = cursor;
  let parameters: Token[] = [];

  if (currentToken && currentToken.kind === TokenKind.RightParenthesis) {
    return {
      cursor,
      parameters,
      tokens: []
    };
  }

  while (index < tokens.length && currentToken.kind !== TokenKind.RightParenthesis) {
    if (currentToken.kind === TokenKind.Identifier) {
      parameters.push(currentToken);
    }
    index++;
    currentToken = tokens[index];
  }

  return {
    cursor: index,
    parameters,
    tokens: tokens.slice(cursor, index)
  };
}

function parseGroupedExpression(tokens: Token[], cursor: number): ExpressionParseResult {
  let expressionParseResult = parseExpression(tokens, cursor + Skip.Parenthesis, Precedence.Lowest);
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
  let conditionParseResult = parseExpression(tokens, cursor + Skip.If, Precedence.Lowest);
  let consequenceParseResult = parseBlockStatement(tokens, conditionParseResult.cursor + Skip.Brace);
  let alternativeParseResult;

  let possibleElseToken = tokens[consequenceParseResult.cursor + 1];

  if (possibleElseToken && possibleElseToken.kind === TokenKind.Else) {
    alternativeParseResult = parseBlockStatement(tokens, consequenceParseResult.cursor + Skip.Brace + Skip.Else + Skip.Brace);
  }

  let ifExpressionParseResultCursor = alternativeParseResult ? alternativeParseResult.cursor : consequenceParseResult.cursor;

  let expression = createExpression(tokens.slice(cursor, ifExpressionParseResultCursor + Include.Brace));
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

  let rightExpressionParseResult = parseExpression(tokens, cursor + Skip.Operator, currentPrecedence);

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
    case TokenKind.Function:
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
