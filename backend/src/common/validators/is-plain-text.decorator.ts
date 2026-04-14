import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Validação mínima para campos que devem ser **texto puro** (sem HTML).
 *
 * - Bloqueia tags HTML típicas (ex.: "<b>", "</script>", "<img ...>")
 * - Não tenta "sanitizar" conteúdo; apenas rejeita quando parece HTML.
 *
 * Observação: permite casos comuns como "<3" (não é tag).
 */
export function IsPlainText(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isPlainText',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          // @IsOptional controla ausência.
          if (value === null || value === undefined) {
            return true;
          }
          if (typeof value !== 'string') {
            return false;
          }

          // Detecta início de tag: "<" seguido de letra (com espaços opcionais) e/ou "</".
          // Ex.: "<b>", "</div>", "<img", "<svg onload=...>"
          const looksLikeHtmlTag = /<\s*\/?\s*[a-z]/i.test(value);
          return !looksLikeHtmlTag;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} deve ser texto puro (HTML não é permitido)`;
        },
      },
    });
  };
}

