import streamlit as st

# Configure the Streamlit page
st.set_page_config(
    page_title="Local LLM Arcade",
    page_icon="🎮",
    layout="centered"
)

# Sidebar navigation
game_choice = st.sidebar.radio(
    "Choose a Game",
    ["🏰 Snarky Gargoyle", "💀 1-HP Dungeon", "🔎 Two Truths & A Lie"]
)

# Import UI modules conditionally
if game_choice == "🏰 Snarky Gargoyle":
    from game1_gargoyle.ui import render as render_gargoyle
elif game_choice == "💀 1-HP Dungeon":
    from game2_dungeon.ui import render as render_dungeon
else:
    from game3_trivia.ui import render as render_trivia

# Header
st.title("🎮 Local LLM Arcade")
st.markdown(
    """
Welcome to the **Local LLM Arcade**!  
All games run entirely on your machine using the `gpt-oss:20b` model via Ollama. No external API keys are required.
"""
)

# Render selected game
if game_choice == "🏰 Snarky Gargoyle":
    render_gargoyle()
elif game_choice == "💀 1-HP Dungeon":
    render_dungeon()
else:
    render_trivia()

# Footer
st.markdown("---")
st.caption("All models run locally via Ollama (`gpt-oss:20b`). Enjoy the games!")
