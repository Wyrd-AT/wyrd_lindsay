#!/usr/bin/env python3
"""
Script para criar usuários de teste no Cognito com custom attributes
Cria: 1 Admin + 1 Revenda + 1 Cliente

Uso:
    python create_test_users.py

Antes de executar, configure:
    - USER_POOL_ID
    - REGION
"""

import boto3
import json
from datetime import datetime
from typing import Dict, Any, Optional

# ===== CONFIGURAÇÃO =====
USER_POOL_ID = "sa-east-1_bm329gdfB"  # ← Correto (visto nos logs de erro do Cognito)
REGION = "sa-east-1"

# ===== CORES PARA OUTPUT =====
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(title: str):
    """Imprime header de seção"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {title}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}\n")


def print_success(msg: str):
    """Imprime mensagem de sucesso"""
    print(f"{Colors.GREEN}✅ {msg}{Colors.ENDC}")


def print_error(msg: str):
    """Imprime mensagem de erro"""
    print(f"{Colors.RED}❌ {msg}{Colors.ENDC}")


def print_info(msg: str):
    """Imprime mensagem de informação"""
    print(f"{Colors.CYAN}ℹ️  {msg}{Colors.ENDC}")


def print_user_data(user_data: Dict[str, Any]):
    """Imprime dados do usuário de forma formatada"""
    print(f"\n  {Colors.BOLD}Email:{Colors.ENDC} {user_data.get('email')}")
    print(f"  {Colors.BOLD}Nome:{Colors.ENDC} {user_data.get('name')}")
    print(f"  {Colors.BOLD}Type:{Colors.ENDC} {user_data.get('type')}")
    print(f"  {Colors.BOLD}Status:{Colors.ENDC} {user_data.get('status')}")

    if user_data.get('domain'):
        print(f"  {Colors.BOLD}Domínio:{Colors.ENDC} {user_data.get('domain')}")
    if user_data.get('doc_id'):
        print(f"  {Colors.BOLD}Doc ID:{Colors.ENDC} {user_data.get('doc_id')}")
    if user_data.get('revenda_id'):
        print(f"  {Colors.BOLD}Revenda ID:{Colors.ENDC} {user_data.get('revenda_id')}")


class CognitoUserManager:
    """Gerenciador de usuários Cognito"""

    def __init__(self, user_pool_id: str, region: str):
        self.user_pool_id = user_pool_id
        self.region = region
        self.cognito = boto3.client('cognito-idp', region_name=region)

    def create_user(
        self,
        email: str,
        name: str,
        password: str,
        user_type: str,
        status: str,
        **custom_attrs
    ) -> Dict[str, Any]:
        """
        Cria um usuário no Cognito com custom attributes

        Args:
            email: Email do usuário
            name: Nome do usuário
            password: Senha do usuário
            user_type: Tipo (admin, revenda, cliente)
            status: Status (active, pending, rejected)
            **custom_attrs: Atributos customizados adicionais (domain, revenda_id, doc_id)

        Returns:
            Dicionário com dados do usuário criado
        """
        try:
            # Montar lista de atributos
            user_attributes = [
                {'Name': 'email', 'Value': email},
                {'Name': 'name', 'Value': name},
                {'Name': 'custom:type', 'Value': user_type},
                {'Name': 'custom:status', 'Value': status},
            ]

            # Adicionar custom attributes
            if custom_attrs.get('domain'):
                user_attributes.append({
                    'Name': 'custom:domain',
                    'Value': custom_attrs['domain']
                })
            if custom_attrs.get('revenda_id'):
                user_attributes.append({
                    'Name': 'custom:revenda_id',
                    'Value': custom_attrs['revenda_id']
                })
            if custom_attrs.get('doc_id'):
                user_attributes.append({
                    'Name': 'custom:doc_id',
                    'Value': custom_attrs['doc_id']
                })

            # Criar usuário
            self.cognito.admin_create_user(
                UserPoolId=self.user_pool_id,
                Username=email,
                TemporaryPassword=password,
                MessageAction='SUPPRESS',  # Não enviar email
                UserAttributes=user_attributes
            )

            print_success(f"Usuário criado: {email}")

            # Definir senha permanente
            self.cognito.admin_set_user_password(
                UserPoolId=self.user_pool_id,
                Username=email,
                Password=password,
                Permanent=True
            )

            print_success(f"Senha definida para: {email}")

            # Retornar dados do usuário
            return {
                'email': email,
                'name': name,
                'type': user_type,
                'status': status,
                'domain': custom_attrs.get('domain'),
                'revenda_id': custom_attrs.get('revenda_id'),
                'doc_id': custom_attrs.get('doc_id'),
                'password': password,
            }

        except Exception as e:
            print_error(f"Erro ao criar usuário {email}: {str(e)}")
            raise

    def get_user(self, email: str) -> Optional[Dict[str, Any]]:
        """Recupera dados de um usuário"""
        try:
            response = self.cognito.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=email
            )

            # Converter attributes para dicionário
            attrs = {attr['Name']: attr['Value'] for attr in response['UserAttributes']}

            return {
                'email': attrs.get('email'),
                'name': attrs.get('name'),
                'type': attrs.get('custom:type'),
                'status': attrs.get('custom:status'),
                'domain': attrs.get('custom:domain'),
                'revenda_id': attrs.get('custom:revenda_id'),
                'doc_id': attrs.get('custom:doc_id'),
            }

        except Exception as e:
            print_error(f"Erro ao recuperar usuário {email}: {str(e)}")
            return None

    def delete_user(self, email: str) -> bool:
        """Deleta um usuário"""
        try:
            self.cognito.admin_delete_user(
                UserPoolId=self.user_pool_id,
                Username=email
            )
            print_success(f"Usuário deletado: {email}")
            return True
        except Exception as e:
            print_error(f"Erro ao deletar usuário: {str(e)}")
            return False


def main():
    """Função principal"""

    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("╔════════════════════════════════════════╗")
    print("║   Criar Usuários de Teste - Cognito    ║")
    print("╚════════════════════════════════════════╝")
    print(f"{Colors.ENDC}\n")

    # ===== VALIDAÇÃO INICIAL =====
    if USER_POOL_ID == "sa-east-1_XXXXX":
        print_error("USER_POOL_ID não está configurado!")
        print("Edite o script e mude: USER_POOL_ID = 'seu-user-pool-id'")
        return

    print_info(f"User Pool ID: {USER_POOL_ID}")
    print_info(f"Região: {REGION}\n")

    # ===== INICIALIZAR MANAGER =====
    manager = CognitoUserManager(USER_POOL_ID, REGION)

    # ===== DADOS DOS USUÁRIOS A CRIAR =====
    users_to_create = [
        {
            'title': 'ADMIN',
            'email': 'admin@company.com',
            'name': 'Admin User',
            'password': 'Admin@12345',
            'type': 'admin',
            'status': 'active',
            'custom_attrs': {
                'doc_id': 'admin:admin@company.com',
            }
        },
        {
            'title': 'REVENDA',
            'email': 'revenda@example.com',
            'name': 'Revenda Example',
            'password': 'Revenda@12345',
            'type': 'revenda',
            'status': 'active',
            'custom_attrs': {
                'domain': 'example.com',
                'doc_id': 'revenda:example.com',
            }
        },
        {
            'title': 'CLIENTE',
            'email': 'cliente@example.com',
            'name': 'Cliente Example',
            'password': 'Cliente@12345',
            'type': 'cliente',
            'status': 'pending',
            'custom_attrs': {
                'revenda_id': 'revenda:example.com',
            }
        },
    ]

    # ===== CRIAR USUÁRIOS =====
    created_users = []

    for user_config in users_to_create:
        print_header(f"Criando {user_config['title']}")

        try:
            user_data = manager.create_user(
                email=user_config['email'],
                name=user_config['name'],
                password=user_config['password'],
                user_type=user_config['type'],
                status=user_config['status'],
                **user_config['custom_attrs']
            )

            print_user_data(user_data)
            created_users.append(user_data)

        except Exception as e:
            print_error(f"Falha ao criar {user_config['title']}")
            continue

    # ===== VERIFICAR USUÁRIOS CRIADOS =====
    if created_users:
        print_header("Verificando Usuários Criados")

        for user_data in created_users:
            print_info(f"Recuperando dados de {user_data['email']}...")
            verified_user = manager.get_user(user_data['email'])

            if verified_user:
                print_success(f"Usuário verificado: {user_data['email']}")
                print_user_data(verified_user)
            else:
                print_error(f"Não foi possível verificar: {user_data['email']}")

    # ===== RESUMO FINAL =====
    print_header("✅ RESUMO FINAL")

    summary_table = """
╔════════════════════════════════════════════════════════════════╗
║                    USUÁRIOS CRIADOS                            ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  👑 ADMIN                                                      ║
║     Email:    admin@company.com                               ║
║     Senha:    Admin@12345                                     ║
║     Status:   active                                          ║
║                                                                ║
║  🏢 REVENDA                                                    ║
║     Email:    revenda@example.com                             ║
║     Senha:    Revenda@12345                                   ║
║     Status:   active                                          ║
║     Domínio:  example.com                                     ║
║                                                                ║
║  👤 CLIENTE                                                    ║
║     Email:    cliente@example.com                             ║
║     Senha:    Cliente@12345                                   ║
║     Status:   pending (aguardando aprovação da revenda)       ║
║     Revenda:  example.com                                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
"""

    print(Colors.GREEN + summary_table + Colors.ENDC)

    # ===== PRÓXIMOS PASSOS =====
    print_header("📋 Próximos Passos")

    next_steps = """
1. Testar login do Admin:
   aws cognito-idp admin-initiate-auth \\
     --user-pool-id {pool_id} \\
     --client-id YOUR_CLIENT_ID \\
     --auth-flow ADMIN_NO_SRP_AUTH \\
     --auth-parameters USERNAME=admin@company.com,PASSWORD=Admin@12345 \\
     --region {region}

2. Frontend: Usar dados no .env
   VITE_COGNITO_USER_POOL_ID={pool_id}
   VITE_COGNITO_CLIENT_ID=YOUR_CLIENT_ID

3. Testar flow completo:
   - Login como Admin
   - Aprovar Revenda (cliente está pending)
   - Login como Revenda
   - Aprovar Cliente
   - Login como Cliente (vai ter acesso ao dashboard)

4. Para deletar usuários de teste:
   python create_test_users.py --delete
""".format(pool_id=USER_POOL_ID, region=REGION)

    print(next_steps)

    print(f"{Colors.BOLD}{Colors.GREEN}🎉 Script finalizado com sucesso!{Colors.ENDC}\n")


if __name__ == '__main__':
    main()
