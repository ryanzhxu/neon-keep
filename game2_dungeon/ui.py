import streamlit as st

from .logic import DungeonLogic


def render():
    # Title
    st.title("💀 1-HP Dungeon (Survive 5 Turns)")

    # Session state initialization
    if "dungeon_engine" not in st.session_state:
        st.session_state.dungeon_engine = DungeonLogic()
    if "dungeon_turn" not in st.session_state:
        st.session_state.dungeon_turn = 1
    if "dungeon_alive" not in st.session_state:
        st.session_state.dungeon_alive = True
    if "dungeon_logs" not in st.session_state:
        st.session_state.dungeon_logs = []

    engine: DungeonLogic = st.session_state.dungeon_engine
    turn = st.session_state.dungeon_turn
    alive = st.session_state.dungeon_alive
    logs = st.session_state.dungeon_logs

    # Health badge
    if alive:
        st.markdown("🟢 HP: 1/1")
    else:
        st.markdown("🔴 HP: 0/1 (DEAD)")

    # Turn metric
    st.metric("Turn", f"{turn} / 5")

    # Narrative log
    if logs:
        st.subheader("Story Log")
        for entry in logs:
            st.write(entry)

    # Action input
    action = st.text_input("Your next move:")
    if st.button("Take Action") and action.strip():
        result = engine.process_turn(action)
        alive = result.get("alive", False)
        story = result.get("story", "")
        st.session_state.dungeon_alive = alive
        st.session_state.dungeon_logs.append(story)

        # Increment turn only if still alive or after processing
        st.session_state.dungeon_turn += 1

        # Victory check
        if not alive:
            st.error("☠️ GAME OVER! You died.")
        elif st.session_state.dungeon_turn > 5 and alive:
            st.snow()
            st.success("🏆 YOU SURVIVED THE DUNGEON!")

    # New run button
    if st.button("New Run"):
        st.session_state.dungeon_engine = DungeonLogic()
        st.session_state.dungeon_turn = 1
        st.session_state.dungeon_alive = True
        st.session_state.dungeon_logs = []
