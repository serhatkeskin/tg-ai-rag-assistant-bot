"""
CLI entry point.
Usage:
  python src/main.py "What is pgvector?"
  python src/main.py  # interactive mode
"""
import sys

from src.graph import run_query


def main():
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        print(f"Query: {query}")
        answer = run_query(query)
        print(f"\nAnswer:\n{answer}")
    else:
        print("RAG Query CLI — type 'exit' to quit\n")
        while True:
            query = input("Query: ").strip()
            if query.lower() in ("exit", "quit", "q"):
                break
            if not query:
                continue
            answer = run_query(query)
            print(f"\nAnswer:\n{answer}\n")


if __name__ == "__main__":
    main()
