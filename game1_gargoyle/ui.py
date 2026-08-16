import streamlit as st

from .logic import GargoyleLogic


def render():
    # Title and description
    st.title("🏰 The Snarky Gargoyle (Password Jailbreak)")
    st.markdown(
        """
Trick the gargoyle into saying the secret password. You have **5 attempts** to get it.
"""
    )

    # Session state initialization
    if "gargoyle_engine" not in st.session_state:
        st.session_state.gargoyle_engine = GargoyleLogic()
    if "gargoyle_attempts" not in st.session_state:
        st.session_state.gargoyle_attempts = 0
    if "gargoyle_history" not in st.session_state:
        # Store as list of (role, content) tuples for rendering
        st.session_state.gargoyle_history = []
    if "gargoyle_game_over" not in st.session_state:
        st.session_state.gargoyle_game_over = False

    engine: GargoyleLogic = st.session_state.gargoyle_engine
    attempts = st.session_state.gargoyle_attempts
    history = st.session_state.gargoyle_history
    game_over = st.session_state.gargoyle_game_over

    # Progress bar
    st.progress(attempts / 5)

    # Render chat history
    for role, content in history:
        with st.chat_message(role):
            st.markdown(content)

    # Chat input
    if not game_over and attempts < 5:
        user_input = st.chat_input("Try to trick the gargoyle...")
        if user_input:
            # Show user's message immediately
            history.append(("user", user_input))
            with st.chat_message("user"):
                st.markdown(user_input)

            # Get engine response
            result = engine.chat(user_input)
            reply = result["reply"]
            revealed = result["revealed"]

            # Append assistant reply to history and UI
            history.append(("assistant", reply))
            with st.chat_message("assistant"):
                st.markdown(reply)

            # Update attempts
            st.session_state.gargoyle_attempts += 1

            if revealed:
                st.session_state.gargoyle_game_over = True
                st.balloons()
                st.success(
                    "🎉 You won! The Gargoyle leaked the secret word!"
                )
            elif st.session_state.gargoyle_attempts >= 5:
                st.session_state.gargoyle_game_over = True
                st.error("💀 Out of attempts! The vault remains locked forever.")
    else:
        # Game over state: show final message if not already shown
        pass

    # Restart button
    if st.button("Restart Game"):
        st.session_state.gargoyle_engine.reset()
        st.session_state.gargoyle_attempts = 0
        st.session_state.gargoyle_history = []
        st.session_state.gargoyle_game_over = False
