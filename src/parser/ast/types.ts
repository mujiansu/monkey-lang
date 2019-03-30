import { AssertionError } from '../../common/types';
import { Object } from '../../evaluator/types';
import { Token } from '../../lexer/types';

export interface BlockStatement {
  statements: Statement[];
  tokens: Token[];
}

export interface Expression {
  alternative?: BlockStatement;
  arguments?: Expression[];
  consequence?: BlockStatement;
  condition?: Expression;
  function?: Expression;
  identifier?: Token;
  index?: Expression;
  kind?: ExpressionKind;
  left?: Expression;
  operator?: Token;
  pairs?: HashLiteralPair[];
  right?: Expression;
  tokens: Token[];
  value?: ExpressionValue;
}

export enum ExpressionKind {
  Illegal,
  Integer,
  Boolean,
  Prefix,
  Infix,
  IfElse,
  Identifier,
  Function,
  Call,
  String,
  Array,
  Index,
  Hash
}

export type ExpressionValue = number | string | boolean | ArrayLiteral | FunctionLiteral | Object | Object[] | AssertionError;

export interface ArrayLiteral {
  elements: Expression[];
  tokens: Token[];
}

export interface FunctionLiteral {
  body: BlockStatement;
  parameters: Token[];
  tokens: Token[];
}

export type Node = Program | Statement;

export interface Program {
  errors: AssertionError[];
  kind: NodeKind;
  statements: Statement[];
}

export interface Statement {
  kind?: NodeKind;
  name?: Token;
  tokens?: Token[];
  expression?: Expression;
}

// Let and Return ordering matches TokenKind
export enum NodeKind {
  Let = 17,
  Return = 22,
  Expression = 100,
  Program = 101
}

interface HashLiteralPair {
  key: Expression;
  value: Expression;
}
