# Example Module for Hackathon Demo
def compute_tax(subtotal: float, rate: float = 0.08) -> float:
    """Calculates sales tax."""
    return round(subtotal * rate, 2)

def format_currency(amount: float) -> str:
    return f'${amount:,.2f}'
