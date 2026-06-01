import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// قشرة التبويبات السفلية للسائق: الرئيسية / السجلّ / حسابي.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.child});

  final Widget child;

  static const _tabs = ['/home', '/history', '/profile'];

  int _indexFor(String location) {
    if (location.startsWith('/history')) return 1;
    if (location.startsWith('/profile')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = _indexFor(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i]),
        backgroundColor: Colors.white,
        indicatorColor: AppColors.navy100,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppColors.navy600),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.history),
            selectedIcon: Icon(Icons.history, color: AppColors.navy600),
            label: 'السجلّ',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.navy600),
            label: 'حسابي',
          ),
        ],
      ),
    );
  }
}
