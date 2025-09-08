# FUNÇÕES PARA PREENCHIMENTO DO FORMULÁRIO DE MACROSCOPIA

## DEFINIÇÕES DAS FUNÇÕES GPT-4 MINI

### 1. preencher_identificacao
Extrai informações de identificação da amostra.

```json
{
  "name": "preencher_identificacao",
  "description": "Extrai dados de identificação da peça analisada",
  "parameters": {
    "type": "object",
    "properties": {
      "numero_peca": {
        "type": "string",
        "description": "Número ou código de identificação da peça/amostra"
      },
      "tipo_tecido": {
        "type": "string",
        "description": "Tipo de tecido ou órgão (ex: pele, mama, colo uterino, intestino)"
      },
      "localizacao": {
        "type": "string",
        "description": "Localização anatômica específica da amostra"
      },
      "procedencia": {
        "type": "string",
        "description": "Origem da amostra (cirúrgica, biópsia, punção, etc.)"
      }
    },
    "required": ["tipo_tecido"]
  }
}
```

### 2. preencher_coloracao
Determina as características de coloração da amostra.

```json
{
  "name": "preencher_coloracao",
  "description": "Identifica e categoriza a coloração macroscópica da peça",
  "parameters": {
    "type": "object",
    "properties": {
      "cor_predominante": {
        "type": "string",
        "enum": ["rosada", "esbranquiçada", "amarelada", "acastanhada", "avermelhada", "arroxeada", "enegrecida", "outras"],
        "description": "Cor predominante observada na peça"
      },
      "cor_secundaria": {
        "type": "string",
        "enum": ["rosada", "esbranquiçada", "amarelada", "acastanhada", "avermelhada", "arroxeada", "enegrecida", "ausente"],
        "description": "Cor secundária se presente"
      },
      "distribuicao": {
        "type": "string",
        "enum": ["homogênea", "heterogênea", "focal", "difusa", "variegada"],
        "description": "Padrão de distribuição das cores"
      },
      "observacoes_cor": {
        "type": "string",
        "description": "Observações adicionais sobre coloração específica"
      }
    },
    "required": ["cor_predominante"]
  }
}
```

### 3. preencher_consistencia
Avalia as propriedades de consistência da amostra.

```json
{
  "name": "preencher_consistencia",
  "description": "Determina a consistência táctil da peça ao exame macroscópico",
  "parameters": {
    "type": "object",
    "properties": {
      "consistencia_principal": {
        "type": "string",
        "enum": ["mole", "elástica", "firme", "endurecida", "friável", "gelatinosa", "cística"],
        "description": "Consistência predominante da peça"
      },
      "homogeneidade": {
        "type": "string",
        "enum": ["homogênea", "heterogênea"],
        "description": "Uniformidade da consistência em toda a peça"
      },
      "areas_diferentes": {
        "type": "string",
        "description": "Descrição de áreas com consistência diferente, se presentes"
      }
    },
    "required": ["consistencia_principal"]
  }
}
```

### 4. preencher_superficie
Caracteriza o aspecto da superfície da amostra.

```json
{
  "name": "preencher_superficie",
  "description": "Descreve as características da superfície externa da peça",
  "parameters": {
    "type": "object",
    "properties": {
      "aspecto_superficie": {
        "type": "string",
        "enum": ["lisa", "rugosa", "irregular", "nodular", "ulcerada", "papilomatosa"],
        "description": "Aspecto predominante da superfície"
      },
      "brilho": {
        "type": "string",
        "enum": ["brilhante", "opaca", "fosca"],
        "description": "Característica de brilho da superfície"
      },
      "presenca_secrecao": {
        "type": "boolean",
        "description": "Presença de secreção ou exsudato na superfície"
      },
      "tipo_secrecao": {
        "type": "string",
        "description": "Tipo de secreção se presente (serosa, purulenta, sanguinolenta)"
      }
    },
    "required": ["aspecto_superficie"]
  }
}
```

### 5. identificar_lesoes
Identifica e descreve lesões ou alterações focais.

```json
{
  "name": "identificar_lesoes",
  "description": "Identifica e descreve lesões, manchas ou alterações focais na peça",
  "parameters": {
    "type": "object",
    "properties": {
      "presenca_lesoes": {
        "type": "boolean",
        "description": "Indica se há lesões visíveis na peça"
      },
      "tipo_lesao": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["mancha", "nódulo", "massa", "cisto", "úlcera", "erosão", "fissura", "outras"]
        },
        "description": "Tipos de lesões identificadas"
      },
      "localizacao_lesao": {
        "type": "string",
        "description": "Localização das lesões na peça"
      },
      "tamanho_aproximado": {
        "type": "string",
        "description": "Tamanho aproximado das lesões principais"
      },
      "caracteristicas_lesao": {
        "type": "string",
        "description": "Características específicas das lesões (cor, formato, bordas, etc.)"
      }
    },
    "required": ["presenca_lesoes"]
  }
}
```

### 6. avaliar_inflamacao
Avalia sinais macroscópicos de processo inflamatório.

```json
{
  "name": "avaliar_inflamacao",
  "description": "Avalia a presença e intensidade de sinais inflamatórios macroscópicos",
  "parameters": {
    "type": "object",
    "properties": {
      "intensidade_inflamacao": {
        "type": "string",
        "enum": ["ausente", "leve", "moderada", "intensa"],
        "description": "Intensidade dos sinais inflamatórios observados"
      },
      "sinais_presentes": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["hiperemia", "edema", "congestão", "exsudato", "necrose"]
        },
        "description": "Sinais específicos de inflamação identificados"
      },
      "distribuicao_inflamacao": {
        "type": "string",
        "enum": ["focal", "multifocal", "difusa"],
        "description": "Padrão de distribuição do processo inflamatório"
      }
    },
    "required": ["intensidade_inflamacao"]
  }
}
```

### 7. registrar_observacoes
Registra observações gerais e informações complementares.

```json
{
  "name": "registrar_observacoes",
  "description": "Registra observações gerais e informações complementares não cobertas pelos campos específicos",
  "parameters": {
    "type": "object",
    "properties": {
      "observacoes_gerais": {
        "type": "string",
        "description": "Observações gerais sobre a peça analisada"
      },
      "particularidades": {
        "type": "string",
        "description": "Particularidades ou achados especiais"
      },
      "correlacao_clinica": {
        "type": "string",
        "description": "Informações de correlação com dados clínicos quando mencionadas"
      },
      "recomendacoes": {
        "type": "string",
        "description": "Recomendações para análise adicional ou processamento especial"
      }
    }
  }
}
```

### 8. gerar_conclusao
Gera conclusão preliminar baseada nos achados macroscópicos.

```json
{
  "name": "gerar_conclusao",
  "description": "Gera conclusão preliminar baseada nos achados macroscópicos descritos",
  "parameters": {
    "type": "object",
    "properties": {
      "impressao_diagnostica": {
        "type": "string",
        "description": "Impressão diagnóstica preliminar baseada na macroscopia"
      },
      "achados_principais": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Lista dos principais achados macroscópicos"
      },
      "necessidade_microscopia": {
        "type": "boolean",
        "description": "Indica se há necessidade de análise microscópica complementar"
      },
      "observacoes_finais": {
        "type": "string",
        "description": "Observações finais ou recomendações para o exame microscópico"
      }
    },
    "required": ["achados_principais"]
  }
}
```

## ORDEM DE EXECUÇÃO DAS FUNÇÕES

1. `preencher_identificacao` - Sempre executar primeiro
2. `preencher_coloracao` - Características visuais básicas
3. `preencher_consistencia` - Propriedades tácteis
4. `preencher_superficie` - Aspecto superficial
5. `identificar_lesoes` - Alterações focais
6. `avaliar_inflamacao` - Sinais inflamatórios
7. `registrar_observacoes` - Informações complementares
8. `gerar_conclusao` - Síntese final (executar por último)

## NOTAS IMPORTANTES

- Todas as funções devem ser chamadas com base no conteúdo da transcrição
- Campos obrigatórios devem sempre receber valores válidos
- Use "não informado" ou valores padrão quando a informação não estiver disponível
- Mantenha coerência entre as informações extraídas por diferentes funções
- Priorize informações explícitas sobre inferências
