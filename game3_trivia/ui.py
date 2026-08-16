import streamlit as st

from .logic import TriviaLogic


def render():
    # Title
    st.title("🔎 Two Truths and a Generated Lie")

    # Session state initialization
    if "trivia_engine" not in st.session_state:
        st.session_state.trivia_engine = TriviaLogic()
    if "trivia_data" not in st.session_state:
        st.session_state.trivia_data = None
    if "trivia_guessed" not in st.session_state:
        st.session_state.trivia_guessed = False

    engine: TriviaLogic = st.session_state.trivia_engine
    data = st.session_state.trivia_data
    guessed = st.session_state.trivia_guessed

    # Setup view
    topic_input = st.text_input("Enter Topic", value="Deep Sea Creatures")
    if st.button("Generate Quiz"):
        st.session_state.trivia_data = engine.generate_round(topic_input)
        st.session_state.trivia_guessed = False

    data = st.session_state.trivia_data
    guessed = st.session_state.trivia_guessed

    # Gameplay view
    if data:
        facts = data.get("facts", [])
        lie_index = data.get("lie_index", 1) - 1  # convert to zero-based index
        explanation = data.get("explanation", "")

        for idx, fact in enumerate(facts):
            btn_label = f"{idx + 1}. {fact}"
            if st.button(btn_label, key=f"fact_{idx}"):
                if guessed:
                    continue  # already answered
                st.session_state.trivia_guessed = True
                if idx == lie_index:
                    st.success("🎯 Correct! You spotted the AI hallucination!")
                else:
                    st.error(f"❌ Wrong! Option #{lie_index + 1} was the lie.")
                st.info(f"Explanation: {explanation}")

        # Next round button
        if guessed and st.button("Next Round"):
            st.session_state.trivia_data = None
            st.session_state.trivia_guessed = False
