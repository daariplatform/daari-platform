import 'package:daari_core/daari_core.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// قشرة التبويبات السفلية للإدارة: الرئيسية / التقارير / الفريق / المزيد.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.child});

  final Widget child;

  static const _tabs = ['/home', '/reports', '/team', '/more'];

  int _indexFor(String location) {
    if (location.startsWith('/reports')) return 1;
    if (location.startsWith('/team')) return 2;
    if (location.startsWith('/more')) return 3;
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
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard, color: AppColors.navy600),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart, color: AppColors.navy600),
            label: 'التقارير',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups, color: AppColors.navy600),
            label: 'الفريق',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu),
            selectedIcon: Icon(Icons.menu_open, color: AppColors.navy600),
            label: 'المزيد',
          ),
        ],
      ),
    );
  }
}
