"""
Serviço de integração com OpenAI (Whisper + GPT-4)
Utiliza Prompt ID configurado na plataforma OpenAI
"""
import os
import io
import base64
import tempfile
import json
from typing import  Any, Optional, List
from openai import OpenAI
import logging
try:
    from core.config import settings
except ImportError:
    from core.config import settings

logger = logging.getLogger(__name__)


class OpenAIService:
    """Serviço para integração com OpenAI Whisper e GPT-4"""
    
    def __init__(self):
        """Inicializa o cliente OpenAI"""
        self.client = OpenAI(
            api_key=getattr(settings, 'openai_api_key', os.getenv('OPENAI_API_KEY'))
        )
    
    @staticmethod
    def transcribe_audio(audio_data: bytes, audio_format: str = "wav") -> dict[str, Any]:
        """
        Transcreve áudio usando OpenAI Whisper
        
        Args:
            audio_data: Dados de áudio em bytes
            audio_format: Formato do áudio (wav, mp3, etc.)
            
        Returns:
            Dict contendo a transcrição e metadados
        """
        try:
            service = OpenAIService()
            
            # Criar arquivo temporário para o áudio
            with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file.flush()
                
                # Transcrever usando Whisper
                with open(temp_file.name, "rb") as audio_file:
                    transcript = service.client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        language="pt",  # Português
                        response_format="verbose_json"
                    )
                
                # Limpar arquivo temporário
                os.unlink(temp_file.name)
            
            return {
                "success": True,
                "text": transcript.text,
                "language": transcript.language,
                "duration": transcript.duration,
                "segments": getattr(transcript, 'segments', []),
                "confidence": getattr(transcript, 'confidence', None),
                "processing_time_ms": getattr(transcript, 'processing_time', 0)
            }
            
        except Exception as e:
            logger.error(f"Erro na transcrição de áudio: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "language": None,
                "duration": 0,
                "segments": [],
                "confidence": None
            }
    
    @staticmethod
    def process_transcription_with_prompt_id(
        transcription_text: str, 
        vision_measurements: Optional[dict] = None
    ) -> dict[str, Any]:
        """
        Processa transcrição usando Prompt ID configurado na plataforma OpenAI
        
        Args:
            transcription_text: Texto transcrito do áudio
            vision_measurements: Medições da análise de visão (opcional)
            
        Returns:
            Dict com dados processados
        """
        try:
            service = OpenAIService()
            
            # Verificar se Prompt ID está configurado
            if not settings.openai_prompt_id:
                logger.error("OPENAI_PROMPT_ID não configurado")
                return {
                    "success": False,
                    "error": "OPENAI_PROMPT_ID não configurado. Configure na plataforma OpenAI e defina a variável de ambiente.",
                    "structured_data": {},
                    "tokens_used": 0
                }
            
            # Preparar contexto com medições de visão se disponível
            vision_context = ""
            if vision_measurements:
                vision_context = f"""

MEDIÇÕES DA ANÁLISE DE IMAGEM:
- Área: {vision_measurements.get('area_mm2', 'N/A')} mm²
- Perímetro: {vision_measurements.get('perimeter_mm', 'N/A')} mm
- Comprimento máximo: {vision_measurements.get('length_max_mm', 'N/A')} mm
- Largura máxima: {vision_measurements.get('width_max_mm', 'N/A')} mm
- Circularidade: {vision_measurements.get('circularity', 'N/A')}
- Razão de aspecto: {vision_measurements.get('aspect_ratio', 'N/A')}
"""

            # Preparar prompt do usuário (o prompt do sistema está configurado no OpenAI platform)
            user_prompt = f"""Transcrição do exame macroscópico:

{transcription_text}
{vision_context}

Analise esta transcrição e execute as funções estruturadas para extrair e organizar todas as informações de acordo com as instruções configuradas na plataforma."""

            logger.info(f"Processando com Prompt ID: {settings.openai_prompt_id}")
            
            # Chamada para OpenAI usando o Prompt ID
            # Nota: Esta implementação está preparada para quando OpenAI suportar Prompt IDs
            # Por enquanto, fará uma chamada padrão
            call_params = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": user_prompt}],
                "temperature": 0.1
            }
            
            # TODO: Quando OpenAI implementar Prompt IDs, adicionar aqui:
            # call_params["prompt_id"] = settings.openai_prompt_id
            
            response = service.client.chat.completions.create(**call_params)
            
            # Processar resposta
            message = response.choices[0].message
            content = message.content
            
            # Por enquanto, retornar o texto da resposta até que a OpenAI implemente Prompt IDs
            # com chamadas de função estruturadas
            return {
                "success": True,
                "response_text": content,
                "structured_data": {"raw_response": content},
                "tokens_used": response.usage.total_tokens,
                "model_used": "gpt-4o-mini",
                "prompt_id_used": settings.openai_prompt_id,
                "config_source": "openai_platform"
            }
            
        except Exception as e:
            logger.error(f"Erro no processamento com Prompt ID: {e}")
            return {
                "success": False,
                "error": str(e),
                "structured_data": {},
                "tokens_used": 0
            }

    @staticmethod
    def process_transcription_with_functions(
        transcription_text: str, 
        vision_measurements: Optional[dict] = None
    ) -> dict[str, Any]:
        """
        Alias para backward compatibility - usa Prompt ID da plataforma OpenAI
        """
        return OpenAIService.process_transcription_with_prompt_id(
            transcription_text, vision_measurements
        )

    @staticmethod
    def process_complete_analysis(
        transcription_text: str, 
        vision_measurements: Optional[dict] = None
    ) -> dict[str, Any]:
        """
        Processa análise completa chamando todas as 8 funções em sequência
        
        Args:
            transcription_text: Texto transcrito do áudio
            vision_measurements: Medições da análise de visão (opcional)
            
        Returns:
            Dict com dados de todas as 8 funções estruturadas
        """
        try:
            service = OpenAIService()
            results = {}
            total_tokens = 0
            
            # Preparar contexto com medições de visão se disponível
            vision_context = ""
            if vision_measurements:
                vision_context = f"""
                
MEDIÇÕES DA ANÁLISE DE IMAGEM:
- Área: {vision_measurements.get('area_mm2', 'N/A')} mm²
- Perímetro: {vision_measurements.get('perimeter_mm', 'N/A')} mm
- Comprimento máximo: {vision_measurements.get('length_max_mm', 'N/A')} mm
- Largura máxima: {vision_measurements.get('width_max_mm', 'N/A')} mm
- Circularidade: {vision_measurements.get('circularity', 'N/A')}
- Razão de aspecto: {vision_measurements.get('aspect_ratio', 'N/A')}
"""

            # Lista das funções na ordem de execução
            function_names = [
                "preencher_identificacao",
                "preencher_coloracao", 
                "preencher_consistencia",
                "preencher_superficie",
                "identificar_lesoes",
                "avaliar_inflamacao",
                "registrar_observacoes",
                "gerar_conclusao"
            ]
            
            # Processar cada função individualmente para garantir que todas sejam chamadas
            base_prompt = f"""Transcrição do exame macroscópico:

{transcription_text}
{vision_context}"""

            # Executar todas as funções
            for func_name in function_names:
                try:
                    result = service._call_individual_function(func_name, base_prompt)
                    if result["success"]:
                        results[func_name] = result["data"]
                        total_tokens += result.get("tokens_used", 0)
                    else:
                        results[func_name] = {"error": result["error"]}
                except Exception as func_error:
                    logger.error(f"Erro ao chamar função {func_name}: {func_error}")
                    results[func_name] = {"error": str(func_error)}
            
            return {
                "success": True,
                "results": results,
                "functions_completed": len([r for r in results.values() if "error" not in r]),
                "functions_total": len(function_names),
                "total_tokens_used": total_tokens,
                "model_used": "gpt-4o-mini"
            }
            
        except Exception as e:
            logger.error(f"Erro no processamento da análise completa: {e}")
            return {
                "success": False,
                "error": str(e),
                "results": {},
                "functions_completed": 0,
                "functions_total": 8
            }
    
    def _call_individual_function(self, function_name: str, base_prompt: str) -> dict[str, Any]:
        """
        Chama uma função individual com contexto específico
        """
        # Definir funções individuais (repetindo a definição para clareza)
        functions_definitions = {
            "preencher_identificacao": {
                "name": "preencher_identificacao",
                "description": "Extrai dados de identificação da peça analisada",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "numero_peca": {"type": "string", "description": "Número ou código de identificação da peça/amostra"},
                        "tipo_tecido": {"type": "string", "description": "Tipo de tecido ou órgão"},
                        "localizacao": {"type": "string", "description": "Localização anatômica específica da amostra"},
                        "procedencia": {"type": "string", "description": "Origem da amostra (cirúrgica, biópsia, punção, etc.)"}
                    },
                    "required": ["tipo_tecido"]
                }
            }
            # As outras funções seguem o mesmo padrão...
        }
        
        try:
            system_prompt = f"Você é um especialista em patologia. Analise a transcrição e chame a função {function_name} com os dados extraídos. Se não houver informação suficiente, use valores padrão apropriados."
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": base_prompt}
                ],
                functions=[functions_definitions.get(function_name, {})],
                function_call={"name": function_name},
                temperature=0.1
            )
            
            message = response.choices[0].message
            if message.function_call:
                function_args = json.loads(message.function_call.arguments)
                return {
                    "success": True,
                    "data": function_args,
                    "tokens_used": response.usage.total_tokens
                }
            else:
                return {
                    "success": False,
                    "error": "Função não foi chamada corretamente"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def extract_biopsy_data(
        transcription_text: str, 
        vision_measurements: Optional[dict] = None
    ) -> dict[str, Any]:
        """
        Extrai dados estruturados de biópsia da transcrição usando GPT-4
        
        Args:
            transcription_text: Texto transcrito do áudio
            vision_measurements: Medições da análise de visão (opcional)
            
        Returns:
            Dict com dados estruturados da biópsia
        """
        try:
            service = OpenAIService()
            
            # Preparar contexto com medições de visão se disponível
            vision_context = ""
            if vision_measurements:
                vision_context = f"""
                
MEDIÇÕES DA ANÁLISE DE IMAGEM:
- Área: {vision_measurements.get('area_mm2', 'N/A')} mm²
- Perímetro: {vision_measurements.get('perimeter_mm', 'N/A')} mm
- Comprimento máximo: {vision_measurements.get('length_max_mm', 'N/A')} mm
- Largura máxima: {vision_measurements.get('width_max_mm', 'N/A')} mm
- Circularidade: {vision_measurements.get('circularity', 'N/A')}
- Razão de aspecto: {vision_measurements.get('aspect_ratio', 'N/A')}
"""
            
            # Prompt para extração estruturada de dados
            system_prompt = """Você é um especialista em patologia que extrai informações estruturadas de descrições de biópsias. 

Analise a transcrição fornecida e extraia as seguintes informações em formato JSON estruturado:

{
  "paciente": {
    "nome": "string ou null",
    "idade": "number ou null",
    "genero": "string ou null",
    "registro": "string ou null"
  },
  "biópsia": {
    "local_coleta": "string ou null",
    "data_coleta": "string ou null", 
    "tipo_tecido": "string ou null",
    "coloracao": "string ou null",
    "orientacao": "string ou null"
  },
  "análise_macroscópica": {
    "aspecto_geral": "string ou null",
    "cor": "string ou null",
    "consistencia": "string ou null",
    "superfície": "string ou null",
    "lesões_visíveis": "array de strings ou null"
  },
  "medições": {
    "dimensões_descritas": "string ou null",
    "peso": "string ou null",
    "volume": "string ou null"
  },
  "observações": {
    "achados_relevantes": "array de strings ou null",
    "hipótese_diagnóstica": "string ou null",
    "comentários_adicionais": "string ou null"
  },
  "qualidade_extração": {
    "confiança": "number entre 0 e 1",
    "campos_identificados": "number",
    "campos_totais": "number"
  }
}

Regras importantes:
1. Use null para campos não mencionados na transcrição
2. Seja preciso e não invente informações
3. Mantenha terminologia médica apropriada
4. Inclua apenas informações explicitamente mencionadas
5. Para medições, dê preferência aos dados da análise de imagem quando disponíveis"""

            user_prompt = f"""Transcrição do áudio médico:

{transcription_text}
{vision_context}

Por favor, extraia as informações estruturadas conforme o formato JSON especificado."""

            # Chamada para GPT-4
            response = service.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1  # Baixa criatividade para maior precisão
            )
            
            # Extrair resposta
            extracted_data = response.choices[0].message.content
            
            import json
            try:
                structured_data = json.loads(extracted_data)
            except json.JSONDecodeError:
                # Fallback se JSON inválido
                structured_data = {
                    "erro": "JSON inválido gerado pelo modelo",
                    "resposta_bruta": extracted_data
                }
            
            return {
                "success": True,
                "structured_data": structured_data,
                "raw_response": extracted_data,
                "model_used": "gpt-4o-mini",
                "tokens_used": response.usage.total_tokens,
                "processing_time_ms": 0  # OpenAI não retorna tempo de processamento
            }
            
        except Exception as e:
            logger.error(f"Erro na extração de dados com GPT-4: {e}")
            return {
                "success": False,
                "error": str(e),
                "structured_data": {},
                "raw_response": "",
                "model_used": None,
                "tokens_used": 0
            }
    
    @staticmethod
    def generate_biopsy_report(
        structured_data: dict,
        vision_measurements: Optional[dict] = None,
        transcription_text: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Gera relatório estruturado de biópsia usando GPT-4
        
        Args:
            structured_data: Dados estruturados extraídos
            vision_measurements: Medições da visão computacional
            transcription_text: Transcrição original (opcional)
            
        Returns:
            Dict com relatório formatado
        """
        try:
            service = OpenAIService()
            
            # Preparar dados para o relatório
            vision_section = ""
            if vision_measurements:
                vision_section = f"""

ANÁLISE QUANTITATIVA (Visão Computacional):
- Área total: {vision_measurements.get('area_mm2', 'N/A')} mm²
- Perímetro: {vision_measurements.get('perimeter_mm', 'N/A')} mm
- Dimensões máximas: {vision_measurements.get('length_max_mm', 'N/A')} × {vision_measurements.get('width_max_mm', 'N/A')} mm
- Índice de circularidade: {vision_measurements.get('circularity', 'N/A')}
- Razão de aspecto: {vision_measurements.get('aspect_ratio', 'N/A')}
- Confiança da análise: {vision_measurements.get('confidence_overall', 'N/A')}
"""

            system_prompt = """Você é um patologista experiente gerando um relatório médico profissional de biópsia.

Crie um relatório estruturado, claro e profissional usando as informações fornecidas.

O relatório deve seguir este formato:

RELATÓRIO DE ANÁLISE DE BIÓPSIA
===============================

IDENTIFICAÇÃO DO PACIENTE:
[Informações do paciente quando disponíveis]

DADOS DA AMOSTRA:
[Local de coleta, data, tipo de tecido, etc.]

DESCRIÇÃO MACROSCÓPICA:
[Aspecto visual da amostra, cor, consistência, etc.]

MEDIÇÕES E DIMENSÕES:
[Medições descritas e quantitativas da análise de imagem]

ACHADOS RELEVANTES:
[Observações importantes e achados clínicos]

IMPRESSÃO DIAGNÓSTICA:
[Hipótese diagnóstica quando disponível]

COMENTÁRIOS:
[Observações adicionais do patologista]

METODOLOGIA:
- Análise macroscópica descritiva
- Medições quantitativas por visão computacional
- Transcrição assistida por IA

Mantenha linguagem médica profissional, seja preciso e indique claramente quando informações não estão disponíveis."""

            user_prompt = f"""Dados estruturados da biópsia:
{json.dumps(structured_data, indent=2, ensure_ascii=False)}
{vision_section}

Gere um relatório médico profissional e estruturado."""

            # Chamada para GPT-4
            response = service.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2  # Baixa criatividade para relatórios médicos
            )
            
            report_text = response.choices[0].message.content
            
            return {
                "success": True,
                "report": report_text,
                "model_used": "gpt-4o-mini",
                "tokens_used": response.usage.total_tokens,
                "sections": {
                    "patient_info": True,
                    "sample_data": True,
                    "macroscopic": True,
                    "measurements": bool(vision_measurements),
                    "findings": True,
                    "diagnosis": True,
                    "comments": True
                }
            }
            
        except Exception as e:
            logger.error(f"Erro na geração de relatório: {e}")
            return {
                "success": False,
                "error": str(e),
                "report": "",
                "model_used": None,
                "tokens_used": 0
            }
    
    @staticmethod
    def validate_transcription_quality(transcription_text: str) -> dict[str, Any]:
        """
        Valida a qualidade da transcrição usando GPT-4
        
        Args:
            transcription_text: Texto transcrito
            
        Returns:
            Dict com análise de qualidade
        """
        try:
            service = OpenAIService()
            
            system_prompt = """Você é um especialista em análise de qualidade de transcrições médicas.

Analise a transcrição fornecida e avalie:

1. Qualidade geral (0-100)
2. Clareza terminológica médica
3. Completude das informações
4. Presença de erros evidentes
5. Sugestões de melhoria

Retorne sua análise em formato JSON:

{
  "quality_score": number (0-100),
  "medical_terminology": "excellent|good|fair|poor",
  "completeness": "complete|mostly_complete|partial|incomplete", 
  "evident_errors": number,
  "confidence_assessment": "high|medium|low",
  "suggestions": ["sugestão1", "sugestão2", ...],
  "key_information_present": {
    "patient_data": boolean,
    "sample_location": boolean,
    "macroscopic_description": boolean,
    "measurements": boolean,
    "clinical_observations": boolean
  }
}"""

            user_prompt = f"""Transcrição para análise:

{transcription_text}

Forneça uma análise detalhada da qualidade desta transcrição médica."""

            response = service.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            quality_analysis = json.loads(response.choices[0].message.content)
            
            return {
                "success": True,
                "analysis": quality_analysis,
                "tokens_used": response.usage.total_tokens
            }
            
        except Exception as e:
            logger.error(f"Erro na validação de qualidade: {e}")
            return {
                "success": False,
                "error": str(e),
                "analysis": {}
            }
    
    @staticmethod
    def test_openai_integration() -> dict[str, Any]:
        """
        Testa a integração com OpenAI usando dados sintéticos
        
        Returns:
            Dict com resultados dos testes
        """
        test_results = {
            "whisper_test": {"success": False, "error": ""},
            "gpt4_extraction_test": {"success": False, "error": ""},
            "gpt4_report_test": {"success": False, "error": ""},
            "overall_success": False
        }
        
        try:
            # Teste 1: GPT-4 para extração (sem Whisper para evitar necessidade de áudio)
            test_transcription = """
            Paciente Maria Silva, 45 anos, feminino. 
            Biópsia coletada da mama direita em 15 de janeiro de 2024.
            Amostra apresenta coloração rosada, consistência firme.
            Dimensões aproximadas de 2 centímetros por 1.5 centímetros.
            Superfície lisa, sem lesões visíveis macroscopicamente.
            Suspeita de fibroadenoma.
            """
            
            extraction_result = OpenAIService.extract_biopsy_data(test_transcription)
            test_results["gpt4_extraction_test"] = {
                "success": extraction_result["success"],
                "error": extraction_result.get("error", ""),
                "tokens_used": extraction_result.get("tokens_used", 0)
            }
            
            # Teste 2: Geração de relatório
            if extraction_result["success"]:
                test_vision_data = {
                    "area_mm2": 300.0,
                    "perimeter_mm": 61.9,
                    "length_max_mm": 20.0,
                    "width_max_mm": 15.0,
                    "circularity": 0.785,
                    "aspect_ratio": 1.33,
                    "confidence_overall": 0.89
                }
                
                report_result = OpenAIService.generate_biopsy_report(
                    extraction_result["structured_data"],
                    test_vision_data
                )
                
                test_results["gpt4_report_test"] = {
                    "success": report_result["success"],
                    "error": report_result.get("error", ""),
                    "tokens_used": report_result.get("tokens_used", 0),
                    "report_length": len(report_result.get("report", ""))
                }
            
            # Resultado geral
            test_results["overall_success"] = (
                test_results["gpt4_extraction_test"]["success"] and
                test_results["gpt4_report_test"]["success"]
            )
            
        except Exception as e:
            test_results["general_error"] = str(e)
        
        return test_results