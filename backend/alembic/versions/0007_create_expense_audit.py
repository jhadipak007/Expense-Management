"""create expense audit

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-02 17:06:59.448023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    audit = op.create_table('expense_audit',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('expense_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('action', sa.String(length=8), nullable=False),
    sa.Column('changes', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("action IN ('created', 'updated', 'deleted', 'restored')", name=op.f('ck_expense_audit_action')),
    sa.ForeignKeyConstraint(['expense_id'], ['expenses.id'], name=op.f('fk_expense_audit_expense_id_expenses'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_expense_audit_user_id_users'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_expense_audit'))
    )
    with op.batch_alter_table('expense_audit', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_expense_audit_expense_id'), ['expense_id'], unique=False)

    # Plain ALTER, not batch mode: a batch rebuild of expenses fails while audit rows reference it.
    op.add_column('expenses', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    # Every existing expense gets the Created entry it would have had.
    expenses = sa.table('expenses', sa.column('id'), sa.column('user_id'), sa.column('created_at'))
    op.execute(audit.insert().from_select(
        ['expense_id', 'user_id', 'action', 'created_at'],
        sa.select(expenses.c.id, expenses.c.user_id, sa.literal('created'), expenses.c.created_at),
    ))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('expenses', 'deleted_at')

    with op.batch_alter_table('expense_audit', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_expense_audit_expense_id'))

    op.drop_table('expense_audit')
